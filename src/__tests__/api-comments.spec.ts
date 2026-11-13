import { describe, it, expect, vi, beforeEach } from 'vitest';
import { error, isHttpError, type RequestEvent } from '@sveltejs/kit';
import type { UserRow } from '#lib/server/data/user-queries.ts';
import {
	purgeCalls,
	resetCloudflareStub,
	waitUntilPromises
} from '#test/cloudflare-workers.stub.ts';

const listTitleComments = vi.fn();
const getViewerCommentState = vi.fn();
const createComment = vi.fn();
const editComment = vi.fn();
const softDeleteComment = vi.fn();
const setVote = vi.fn();
const removeVote = vi.fn();
const reportComment = vi.fn();
const findCommentTitle = vi.fn();
const resolveCommentTitle = vi.fn();

vi.mock('#lib/server/data/comment-queries.ts', () => ({
	listTitleComments,
	getViewerCommentState,
	createComment,
	editComment,
	softDeleteComment
}));
vi.mock('#lib/server/data/comment-votes.ts', () => ({ setVote, removeVote }));
vi.mock('#lib/server/data/comment-reports.ts', () => ({ reportComment }));
vi.mock('#lib/server/data/comment-title.ts', () => ({
	findCommentTitle,
	resolveCommentTitle,
	// The real one imports the TMDB client; this keeps its contract.
	parseTitleParams: (kind: string, tmdbId: string) => {
		if ((kind !== 'movie' && kind !== 'tv') || !/^\d{1,9}$/.test(tmdbId))
			error(404, 'Title not found');
		return { kind, tmdbId: String(Number(tmdbId)) };
	}
}));

const list = await import('../routes/api/titles/[kind]/[tmdbId]/comments/+server');
const viewer = await import('../routes/api/titles/[kind]/[tmdbId]/comments/viewer/+server');
const comment = await import('../routes/api/comments/[id]/+server');
const vote = await import('../routes/api/comments/[id]/vote/+server');
const report = await import('../routes/api/comments/[id]/report/+server');
const { clearCache } = await import('#lib/server/cache/index.ts');

const TITLE = { id: 't1', kind: 'movie', tmdbId: 348, title: 'Alien' };
const TAG = 'comments:movie:348';
const VOTE_TITLE = { kind: 'movie', tmdbId: 348 };
const OWN = { id: 'c1', status: 'pending', body: 'Hello' };

const user = (overrides: Partial<UserRow> = {}) =>
	({ id: 'u1', role: 'user', bannedAt: null, mutedUntil: null, ...overrides }) as UserRow;

type Options = {
	user?: UserRow | null;
	params?: Record<string, string>;
	body?: unknown;
	rawBody?: string;
	method?: string;
	search?: string;
	getUser?: () => Promise<UserRow | null>;
};

function event({
	user: u = user(),
	params = {},
	body,
	rawBody,
	method = 'GET',
	search = '',
	getUser
}: Options = {}): RequestEvent {
	return {
		params,
		url: new URL(`http://localhost/api/x${search}`),
		request: new Request('http://localhost/api/x', {
			method,
			...(method === 'GET'
				? {}
				: {
						body: rawBody ?? JSON.stringify(body),
						headers: { 'content-type': 'application/json' }
					})
		}),
		locals: { getUser: getUser ?? (async () => u) },
		getClientAddress: () => '203.0.113.9'
	} as unknown as RequestEvent;
}

type Handler = (e: never) => Promise<Response> | Response;
const call = (handler: Handler, options?: Options) => handler(event(options) as never);

async function status(promise: Promise<Response> | Response): Promise<number> {
	try {
		return (await promise).status;
	} catch (err) {
		if (isHttpError(err)) return err.status;
		throw err;
	}
}

const titleParams = { kind: 'movie', tmdbId: '348' };

beforeEach(async () => {
	resetCloudflareStub();
	await clearCache();
	vi.clearAllMocks();
	findCommentTitle.mockResolvedValue(TITLE);
	resolveCommentTitle.mockResolvedValue(TITLE);
	createComment.mockResolvedValue({
		ok: true,
		comment: OWN,
		title: { kind: 'movie', tmdbId: 348 }
	});
	editComment.mockResolvedValue({ ok: true, comment: OWN, title: { kind: 'movie', tmdbId: 348 } });
	softDeleteComment.mockResolvedValue({ ok: true, title: { kind: 'movie', tmdbId: 348 } });
	setVote.mockResolvedValue({ ok: true, score: 1, vote: 1, title: VOTE_TITLE });
	removeVote.mockResolvedValue({ ok: true, score: 0, vote: null, title: VOTE_TITLE });
	reportComment.mockResolvedValue({
		ok: true,
		alreadyReported: false,
		status: 'published',
		title: { kind: 'movie', tmdbId: 348 }
	});
	listTitleComments.mockResolvedValue({ comments: [], nextCursor: null });
	getViewerCommentState.mockResolvedValue({ votes: {}, comments: [], mutedUntil: null });
});

describe('GET the public list', () => {
	it('sends the public comments policy and the title tag, and never reads the user', async () => {
		const getUser = vi.fn();
		const res = await call(list.GET, { params: titleParams, getUser });
		expect(res.status).toBe(200);
		expect(res.headers.get('cache-control')).toBe('public, max-age=0');
		expect(res.headers.get('cdn-cache-control')).toBe('max-age=600, stale-while-revalidate=60');
		expect(res.headers.get('cache-tag')).toBe(TAG);
		expect(res.headers.has('set-cookie')).toBe(false);
		expect(getUser).not.toHaveBeenCalled();
	});

	it('passes the sort and cursor on, and defaults to top', async () => {
		await call(list.GET, { params: titleParams });
		expect(listTitleComments).toHaveBeenLastCalledWith('t1', { sort: 'top', cursor: null });
		await call(list.GET, { params: titleParams, search: '?sort=new&cursor=abc' });
		expect(listTitleComments).toHaveBeenLastCalledWith('t1', { sort: 'new', cursor: 'abc' });
	});

	it('answers an empty list for a title with no row, and 400 or 404 for bad input', async () => {
		findCommentTitle.mockResolvedValue(null);
		const res = await call(list.GET, { params: titleParams });
		await expect(res.json()).resolves.toEqual({ comments: [], nextCursor: null });
		expect(listTitleComments).not.toHaveBeenCalled();
		expect(await status(call(list.GET, { params: titleParams, search: '?sort=hot' }))).toBe(400);
		expect(await status(call(list.GET, { params: { kind: 'show', tmdbId: '1' } }))).toBe(404);
		expect(await status(call(list.GET, { params: { kind: 'movie', tmdbId: 'x' } }))).toBe(404);
	});
});

describe('GET the viewer state', () => {
	it('is private, no-store, and needs a user', async () => {
		const res = await call(viewer.GET, { params: titleParams });
		expect(res.headers.get('cache-control')).toBe('private, no-store');
		expect(getViewerCommentState).toHaveBeenCalledWith('t1', expect.objectContaining({ id: 'u1' }));
		expect(await status(call(viewer.GET, { params: titleParams, user: null }))).toBe(401);
	});
});

describe('POST a comment', () => {
	const post = (options: Options = {}) =>
		call(list.POST, { params: titleParams, method: 'POST', body: { body: ' Hello ' }, ...options });

	it('answers 401 signed out (a banned account is signed out by the hook), 403 muted, and stores nothing', async () => {
		expect(await status(post({ user: null }))).toBe(401);
		expect(await status(post({ user: user({ mutedUntil: new Date(Date.now() + 60_000) }) }))).toBe(
			403
		);
		expect(createComment).not.toHaveBeenCalled();
	});

	it('lets a user whose mute has ended write', async () => {
		expect(await status(post({ user: user({ mutedUntil: new Date(Date.now() - 1000) }) }))).toBe(
			201
		);
	});

	it('answers 429 past the comment limit, per user', async () => {
		for (let i = 0; i < 5; i++) expect(await status(post())).toBe(201);
		expect(await status(post())).toBe(429);
		expect(await status(post({ user: user({ id: 'u2' }) }))).toBe(201);
	});

	it('answers 400 for a malformed or invalid body, after the guards', async () => {
		expect(await status(post({ rawBody: '{nope', body: undefined }))).toBe(400);
		for (const body of [
			{},
			{ body: '   ' },
			{ body: 'x'.repeat(5001) },
			{ body: 'ok', parentId: 5 }
		]) {
			expect(await status(post({ body }))).toBe(400);
		}
		expect(createComment).not.toHaveBeenCalled();
	});

	it('does not parse the body for an unauthorised request', async () => {
		expect(await status(post({ user: null, rawBody: '{nope', body: undefined }))).toBe(401);
	});

	it('stores the trimmed body, answers 201 with the comment, and purges the title tag', async () => {
		const res = await post({ body: { body: ' Hello ', parentId: 'p1' } });
		expect(res.status).toBe(201);
		expect(res.headers.get('cache-control')).toBe('private, no-store');
		await expect(res.json()).resolves.toEqual({ comment: OWN });
		expect(createComment).toHaveBeenCalledWith({
			title: TITLE,
			userId: 'u1',
			body: 'Hello',
			parentId: 'p1'
		});
		await Promise.all(waitUntilPromises);
		expect(purgeCalls).toEqual([{ tags: [TAG] }]);
	});

	it('answers 404 for a reply to a comment that is not there', async () => {
		createComment.mockResolvedValue({ ok: false, reason: 'parent-not-found' });
		expect(await status(post({ body: { body: 'x', parentId: 'gone' } }))).toBe(404);
		await Promise.all(waitUntilPromises);
		expect(purgeCalls).toEqual([]);
	});

	it('logs and swallows a failed purge', async () => {
		const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
		const cache = await import('cloudflare:workers');
		const purge = vi.spyOn(cache.cache, 'purge').mockRejectedValueOnce(new Error('boom'));
		expect((await post()).status).toBe(201);
		await expect(Promise.all(waitUntilPromises)).resolves.toBeDefined();
		expect(spy).toHaveBeenCalled();
		purge.mockRestore();
		spy.mockRestore();
	});
});

describe('PATCH and DELETE a comment', () => {
	const params = { id: 'c1' };

	it('answers 401 signed out and 403 muted', async () => {
		expect(
			await status(
				call(comment.PATCH, { params, method: 'PATCH', body: { body: 'x' }, user: null })
			)
		).toBe(401);
		expect(
			await status(
				call(comment.DELETE, {
					params,
					method: 'DELETE',
					body: {},
					user: user({ mutedUntil: new Date(Date.now() + 60_000) })
				})
			)
		).toBe(403);
	});

	it('edits as the owner, purges the tag, and answers 403 for someone else', async () => {
		const res = await call(comment.PATCH, { params, method: 'PATCH', body: { body: 'Edited' } });
		expect(res.status).toBe(200);
		expect(editComment).toHaveBeenCalledWith('c1', 'u1', 'Edited');
		await Promise.all(waitUntilPromises);
		expect(purgeCalls).toEqual([{ tags: [TAG] }]);

		editComment.mockResolvedValue({ ok: false, reason: 'forbidden' });
		expect(
			await status(
				call(comment.PATCH, {
					params,
					method: 'PATCH',
					body: { body: 'Mine' },
					user: user({ id: 'u2' })
				})
			)
		).toBe(403);
	});

	it('answers 409 for a comment that can no longer be edited and 404 for a missing one', async () => {
		editComment.mockResolvedValue({ ok: false, reason: 'not-editable' });
		expect(
			await status(call(comment.PATCH, { params, method: 'PATCH', body: { body: 'x' } }))
		).toBe(409);
		editComment.mockResolvedValue({ ok: false, reason: 'not-found' });
		expect(
			await status(call(comment.PATCH, { params, method: 'PATCH', body: { body: 'x' } }))
		).toBe(404);
		expect(
			await status(
				call(comment.PATCH, { params: { id: '../x' }, method: 'PATCH', body: { body: 'x' } })
			)
		).toBe(404);
	});

	it('answers 409 when a moderator moved the comment during an edit or a delete', async () => {
		editComment.mockResolvedValue({ ok: false, reason: 'conflict' });
		expect(
			await status(call(comment.PATCH, { params, method: 'PATCH', body: { body: 'x' } }))
		).toBe(409);
		softDeleteComment.mockResolvedValue({ ok: false, reason: 'conflict' });
		expect(await status(call(comment.DELETE, { params, method: 'DELETE', body: {} }))).toBe(409);
	});

	it('deletes as the owner and purges, and answers 403 for someone else', async () => {
		const res = await call(comment.DELETE, { params, method: 'DELETE', body: {} });
		expect(res.status).toBe(200);
		expect(softDeleteComment).toHaveBeenCalledWith('c1', 'u1');
		await Promise.all(waitUntilPromises);
		expect(purgeCalls).toEqual([{ tags: [TAG] }]);

		softDeleteComment.mockResolvedValue({ ok: false, reason: 'forbidden' });
		expect(
			await status(
				call(comment.DELETE, { params, method: 'DELETE', body: {}, user: user({ id: 'u2' }) })
			)
		).toBe(403);
	});
});

describe('votes', () => {
	const params = { id: 'c1' };
	const put = (options: Options = {}) =>
		call(vote.PUT, { params, method: 'PUT', body: { value: 1 }, ...options });

	it('answers 401 and 403 (muted), then 429 past the vote limit', async () => {
		expect(await status(put({ user: null }))).toBe(401);
		expect(await status(put({ user: user({ mutedUntil: new Date(Date.now() + 60_000) }) }))).toBe(
			403
		);
		for (let i = 0; i < 30; i++) expect(await status(put())).toBe(200);
		expect(await status(put())).toBe(429);
	});

	it('sets and removes a vote, and purges the title comment list after each', async () => {
		const res = await put();
		await expect(res.json()).resolves.toEqual({ score: 1, vote: 1 });
		expect(setVote).toHaveBeenCalledWith('c1', 'u1', 1);
		const removed = await call(vote.DELETE, { params, method: 'DELETE', body: {} });
		await expect(removed.json()).resolves.toEqual({ score: 0, vote: null });
		await Promise.all(waitUntilPromises);
		expect(purgeCalls).toEqual([{ tags: [TAG] }, { tags: [TAG] }]);
		expect(waitUntilPromises).toHaveLength(2);
	});

	it('refuses a vote on your own comment (403), a missing one (404) and a bad value (400)', async () => {
		setVote.mockResolvedValue({ ok: false, reason: 'own-comment' });
		expect(await status(put())).toBe(403);
		setVote.mockResolvedValue({ ok: false, reason: 'not-found' });
		expect(await status(put())).toBe(404);
		expect(await status(put({ body: { value: 2 } }))).toBe(400);
		expect(await status(put({ body: { value: 0 } }))).toBe(400);
		await Promise.all(waitUntilPromises);
		expect(purgeCalls).toEqual([]);
		expect(waitUntilPromises).toEqual([]);
	});
});

describe('POST a report', () => {
	const params = { id: 'c1' };
	const post = (options: Options = {}) =>
		call(report.POST, {
			params,
			method: 'POST',
			body: { reason: 'spam', note: ' ad ' },
			...options
		});

	it('answers 401, 403 (muted) and 429 past the report limit', async () => {
		expect(await status(post({ user: null }))).toBe(401);
		expect(await status(post({ user: user({ mutedUntil: new Date(Date.now() + 60_000) }) }))).toBe(
			403
		);
		for (let i = 0; i < 10; i++) expect(await status(post())).toBe(201);
		expect(await status(post())).toBe(429);
	});

	it('stores a report without purging, and purges when it sends the comment to review', async () => {
		const res = await post();
		expect(res.status).toBe(201);
		expect(reportComment).toHaveBeenCalledWith({
			commentId: 'c1',
			reporterId: 'u1',
			reason: 'spam',
			note: 'ad'
		});
		await Promise.all(waitUntilPromises);
		expect(purgeCalls).toEqual([]);

		reportComment.mockResolvedValue({
			ok: true,
			alreadyReported: false,
			status: 'pending',
			title: { kind: 'movie', tmdbId: 348 }
		});
		await post({ user: user({ id: 'u2' }) });
		await Promise.all(waitUntilPromises);
		expect(purgeCalls).toEqual([{ tags: [TAG] }]);
	});

	it('answers 200 for a repeat, 403 for your own comment, 404 for a missing one, 400 for a bad reason', async () => {
		reportComment.mockResolvedValue({
			ok: true,
			alreadyReported: true,
			status: 'published',
			title: { kind: 'movie', tmdbId: 348 }
		});
		expect(await status(post())).toBe(200);
		reportComment.mockResolvedValue({ ok: false, reason: 'own-comment' });
		expect(await status(post())).toBe(403);
		reportComment.mockResolvedValue({ ok: false, reason: 'not-found' });
		expect(await status(post())).toBe(404);
		expect(await status(post({ body: { reason: 'rude' } }))).toBe(400);
	});
});
