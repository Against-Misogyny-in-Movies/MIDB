import { describe, expect, it, vi } from 'vitest';
import type { CommentView, OwnComment } from '#lib/media/types/comments.ts';
import { describeFailure } from '#lib/media/utils/commentApi.ts';
import { CommentsState } from '#lib/media/utils/commentsState.svelte.js';

function view(id: string, over: Partial<CommentView> = {}): CommentView {
	return {
		id,
		parentId: null,
		rootId: null,
		inReplyTo: null,
		removed: false,
		body: `body ${id}`,
		author: { id: 'anna', username: 'anna', avatarKey: null, role: 'user', displayName: 'anna' },
		score: 1,
		replyCount: 0,
		createdAt: '2026-11-01T10:00:00.000Z',
		editedAt: null,
		replies: [],
		...over
	};
}

const OWN: OwnComment = {
	id: 'new',
	parentId: null,
	rootId: null,
	body: 'hello',
	status: 'pending',
	moderationSource: null,
	moderationReason: null,
	score: 0,
	replyCount: 0,
	createdAt: '2026-11-02T10:00:00.000Z',
	editedAt: null
};

const json = (body: unknown, status = 200) =>
	new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

describe('describeFailure', () => {
	it('names a muted and a banned account', () => {
		expect(describeFailure('create', 403, 'Account muted')).toMatch(/muted/);
		expect(describeFailure('vote', 403, 'Account banned')).toMatch(/banned/);
	});

	it('says what failed for each status', () => {
		expect(describeFailure('create', 429)).toMatch(/Too many requests/);
		expect(describeFailure('edit', 401)).toMatch(/sign in again/i);
		expect(describeFailure('load', 0)).toMatch(/could not be reached/);
		expect(describeFailure('edit', 409)).toMatch(/can no longer be edited/);
		expect(describeFailure('create', 400)).toMatch(/1 to 5,000/);
		expect(describeFailure('vote', 403, 'A comment cannot be voted on by its author')).toMatch(
			/voted on by its author/
		);
		expect(describeFailure('report', 500)).toMatch(/report was not sent/);
	});
});

describe('CommentsState', () => {
	it('loads the list for the current sort and appends the next page without repeats', async () => {
		const fetcher = vi
			.fn()
			.mockResolvedValueOnce(json({ comments: [view('a'), view('b')], nextCursor: 'c1' }))
			.mockResolvedValueOnce(json({ comments: [view('b'), view('c')], nextCursor: null }));
		const state = new CommentsState('movie', '603', fetcher);
		await state.load();
		expect(fetcher.mock.calls[0][0]).toBe('/api/titles/movie/603/comments?sort=top');
		expect(state.phase).toBe('ready');
		await state.loadMore();
		expect(fetcher.mock.calls[1][0]).toBe('/api/titles/movie/603/comments?sort=top&cursor=c1');
		expect(state.list.map((c) => c.id)).toEqual(['a', 'b', 'c']);
		expect(state.nextCursor).toBeNull();
	});

	it('reloads on a sort change and ignores a slower answer for the old sort', async () => {
		let releaseTop!: () => void;
		const topGate = new Promise<void>((r) => (releaseTop = r));
		const fetcher = vi.fn(async (url: string) => {
			if (url.endsWith('sort=top')) {
				await topGate;
				return json({ comments: [view('top')], nextCursor: null });
			}
			return json({ comments: [view('new')], nextCursor: null });
		});
		const state = new CommentsState('tv', '1', fetcher);
		const first = state.load();
		await state.setSort('new');
		releaseTop();
		await first;
		expect(state.list.map((c) => c.id)).toEqual(['new']);
	});

	it('records a load failure under its key and phase', async () => {
		const state = new CommentsState('movie', '1', async () => json({ message: 'x' }, 500));
		await state.load();
		expect(state.phase).toBe('error');
		expect(state.errors.load).toMatch(/could not be loaded/);
	});

	it('keeps a pending comment in the viewer state after a post', async () => {
		const state = new CommentsState('movie', '1', async () => json({ comment: OWN }, 201));
		expect(await state.post('hello')).toBe(true);
		expect(state.viewer?.comments.map((c) => c.id)).toEqual(['new']);
		expect(state.notices.compose).toMatch(
			/Only its author and moderators see it until a moderator reviews it/
		);
	});

	it('shows the server message for a muted account and returns false', async () => {
		const state = new CommentsState('movie', '1', async () =>
			json({ message: 'Account muted' }, 403)
		);
		expect(await state.post('hello')).toBe(false);
		expect(state.errors.compose).toMatch(/muted/);
	});

	it('sets a vote from the response, and a second press of the same vote removes it', async () => {
		const fetcher = vi
			.fn()
			.mockResolvedValueOnce(json({ comments: [view('a', { score: 1 })], nextCursor: null }))
			.mockResolvedValueOnce(json({ score: 2, vote: 1 }))
			.mockResolvedValueOnce(json({ score: 1, vote: null }));
		const state = new CommentsState('movie', '1', fetcher);
		await state.load();
		await state.vote('a', 1);
		expect(fetcher.mock.calls[1][1]).toMatchObject({ method: 'PUT', body: '{"value":1}' });
		expect(state.voteOf('a')).toBe(1);
		expect(state.list[0].score).toBe(2);
		await state.vote('a', 1);
		expect(fetcher.mock.calls[2][1]).toMatchObject({ method: 'DELETE' });
		expect(state.voteOf('a')).toBeNull();
		expect(state.list[0].score).toBe(1);
	});

	it('deletes a comment with replies into a placeholder and drops one without', async () => {
		const reply = view('r', { parentId: 'a', rootId: 'a' });
		const fetcher = vi
			.fn()
			.mockResolvedValueOnce(
				json({
					comments: [view('a', { replyCount: 1, replies: [reply] }), view('b')],
					nextCursor: null
				})
			)
			.mockImplementation(async () => json({ ok: true }));
		const state = new CommentsState('movie', '1', fetcher);
		await state.load();
		await state.remove('a');
		expect(state.list[0]).toMatchObject({ id: 'a', removed: true, body: null, author: null });
		await state.remove('b');
		expect(state.list.map((c) => c.id)).toEqual(['a']);
		await state.remove('r');
		expect(state.list[0].replies).toEqual([]);
		expect(state.list[0].replyCount).toBe(0);
	});

	it('moves an edited published comment out of the public list when it goes back to review', async () => {
		const fetcher = vi
			.fn()
			.mockResolvedValueOnce(json({ comments: [view('a')], nextCursor: null }))
			.mockResolvedValueOnce(json({ comment: { ...OWN, id: 'a', body: 'changed' } }));
		const state = new CommentsState('movie', '1', fetcher);
		await state.load();
		expect(await state.edit('a', 'changed')).toBe(true);
		expect(state.list).toEqual([]);
		expect(state.viewer?.comments[0]).toMatchObject({ id: 'a', body: 'changed' });
	});

	it('treats a 401 from the viewer endpoint as signed out, not as an error', async () => {
		const state = new CommentsState('movie', '1', async () =>
			json({ message: 'Unauthorized' }, 401)
		);
		await state.loadViewer();
		expect(state.viewerPhase).toBe('ready');
		expect(state.errors.viewer).toBeUndefined();
	});

	it('reports whether the report was a repeat', async () => {
		const state = new CommentsState('movie', '1', async () => json({ alreadyReported: true }));
		expect(await state.report('a', { reason: 'spam', note: '  ' })).toEqual({
			ok: true,
			alreadyReported: true
		});
	});
});
