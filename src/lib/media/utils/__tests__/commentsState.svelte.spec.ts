import { afterEach, describe, expect, it, vi } from 'vitest';
import type { CommentView, OwnComment } from '#lib/media/types/comments.ts';
import { describeFailure } from '#lib/media/utils/commentApi.ts';
import { CommentsState } from '#lib/media/utils/commentsState.svelte.js';
import { toasts } from '#lib/media/utils/toasts.svelte.js';

afterEach(() => toasts.clear());

/** The toasts showing, as `tone: text`. */
const shown = () => toasts.items.map((t) => `${t.tone}: ${t.text}`);

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
		expect(shown()).toEqual([
			'warn: Comment sent. Only the author and moderators see the comment until a moderator decides.'
		]);
	});

	it('leads a rejected notice with the reason', async () => {
		const rejected: OwnComment = {
			...OWN,
			status: 'rejected',
			moderationReason: 'Attacks a person'
		};
		const state = new CommentsState('movie', '1', async () => json({ comment: rejected }, 201));
		await state.post('hello');
		expect(shown()).toEqual([
			'warn: Rejected: Attacks a person. Only the author and moderators see the comment.'
		]);
	});

	it('keeps a just-published comment in the viewer state until the list carries it', async () => {
		const published: OwnComment = { ...OWN, status: 'published' };
		const state = new CommentsState('movie', '1', async () => json({ comment: published }, 201));
		await state.post('hello');
		expect(state.viewer?.comments.map((c) => c.id)).toEqual(['new']);
		expect(shown()).toEqual(['success: Comment posted.']);
	});

	it('toasts the server message for a muted account and returns false', async () => {
		const state = new CommentsState('movie', '1', async () =>
			json({ message: 'Account muted' }, 403)
		);
		expect(await state.post('hello')).toBe(false);
		expect(shown()).toEqual([expect.stringMatching(/^error: .*muted/)]);
		expect(state.errors.compose).toBeUndefined();
	});

	it('keeps a refusal of the text under the field instead of a toast', async () => {
		const state = new CommentsState('movie', '1', async () => json({ message: 'Too long' }, 400));
		expect(await state.post('hello')).toBe(false);
		expect(state.errors.compose).toBe(describeFailure('create', 400, 'Too long'));
		expect(toasts.items).toEqual([]);
	});

	describe('viewer scores', () => {
		const viewerReply = (scores: Record<string, number>) =>
			json({ votes: { a: 1, c: -1 }, scores, comments: [], mutedUntil: null });

		/** Page one holds `a` and `b`; page two holds `c`. The cached scores are all 1. */
		function setup(scores: Record<string, number>) {
			const fetcher = vi.fn(async (url: unknown, init?: RequestInit) => {
				const u = String(url);
				if (u.endsWith('/viewer')) return viewerReply(scores);
				if (init?.method === 'DELETE') return json({ score: 3, vote: null });
				if (u.includes('cursor='))
					return json({ comments: [view('c', { score: 1 })], nextCursor: null });
				return json({ comments: [view('a'), view('b')], nextCursor: 'next' });
			});
			return { state: new CommentsState('movie', '1', fetcher), fetcher };
		}

		it('overrides the cached score of a voted comment when the viewer state arrives', async () => {
			const { state } = setup({ a: 4 });
			await state.load();
			await state.loadViewer();
			expect(state.list.map((c) => c.score)).toEqual([4, 1]);
		});

		it('overrides it when the list loads after the viewer state, and on a later page', async () => {
			const { state } = setup({ a: 4, c: -2 });
			await state.loadViewer();
			await state.load();
			expect(state.list.map((c) => c.score)).toEqual([4, 1]);
			await state.loadMore();
			expect(state.list.map((c) => c.score)).toEqual([4, 1, -2]);
		});

		it('builds the reader’s next vote on the fresh score', async () => {
			const { state, fetcher } = setup({ a: 4 });
			await state.load();
			await state.loadViewer();
			const pending = state.vote('a', 1);
			expect(state.voteOf('a')).toBeNull();
			expect(state.list[0].score).toBe(3);
			await pending;
			expect(fetcher).toHaveBeenCalledWith(
				'/api/comments/a/vote',
				expect.objectContaining({ method: 'DELETE' })
			);
		});
	});

	describe('votes', () => {
		/** A state with comment `a` (score 1) loaded, and a fetcher that answers each vote request through its own gate. */
		async function setup() {
			const gates: Array<(reply: Response) => void> = [];
			const fetcher = vi.fn(async (_url: unknown, init?: RequestInit) => {
				if (!init?.method || init.method === 'GET')
					return json({ comments: [view('a', { score: 1 })], nextCursor: null });
				return new Promise<Response>((resolve) => gates.push(resolve));
			});
			const state = new CommentsState('movie', '1', fetcher);
			await state.load();
			const requests = () => fetcher.mock.calls.slice(1).map((c) => c[1]?.method);
			return { state, gates, requests };
		}

		it('shows the vote and the score at once, then keeps the server numbers', async () => {
			const { state, gates, requests } = await setup();
			const pending = state.vote('a', 1);
			expect(state.voteOf('a')).toBe(1);
			expect(state.list[0].score).toBe(2);
			expect(requests()).toEqual(['PUT']);
			gates[0](json({ score: 5, vote: 1 }));
			await pending;
			expect(state.voteOf('a')).toBe(1);
			expect(state.list[0].score).toBe(5);
		});

		it.each([
			['none to up', null, 1, 1, 2],
			['none to down', null, -1, -1, 0],
			['up to none', 1, 1, null, 0],
			['down to none', -1, -1, null, 2],
			['up to down', 1, -1, -1, -1],
			['down to up', -1, 1, 1, 3]
		] as const)('moves the score by the delta for %s', async (_name, from, press, to, score) => {
			const { state, gates } = await setup();
			state.viewer = {
				votes: from === null ? {} : { a: from },
				scores: {},
				comments: [],
				mutedUntil: null,
				votesOpenAt: null
			};
			state.list[0].score = 1;
			const pending = state.vote('a', press);
			expect(state.voteOf('a')).toBe(to);
			expect(state.list[0].score).toBe(score);
			gates[0](json({ score, vote: to }));
			await pending;
		});

		it('sends DELETE for a repeated press', async () => {
			const { state, gates, requests } = await setup();
			state.viewer = {
				votes: { a: 1 },
				scores: {},
				comments: [],
				mutedUntil: null,
				votesOpenAt: null
			};
			const pending = state.vote('a', 1);
			expect(requests()).toEqual(['DELETE']);
			gates[0](json({ score: 0, vote: null }));
			await pending;
			expect(state.voteOf('a')).toBeNull();
		});

		it('coalesces rapid clicks into at most one follow-up request, for the last intent', async () => {
			const { state, gates, requests } = await setup();
			const first = state.vote('a', 1);
			void state.vote('a', -1);
			void state.vote('a', 1);
			void state.vote('a', -1);
			expect(requests()).toEqual(['PUT']);
			expect(state.voteOf('a')).toBe(-1);
			expect(state.list[0].score).toBe(0);
			gates[0](json({ score: 2, vote: 1 }));
			await vi.waitFor(() => expect(gates).toHaveLength(2));
			expect(requests()).toEqual(['PUT', 'PUT']);
			expect(state.voteOf('a')).toBe(-1);
			expect(state.list[0].score).toBe(0);
			gates[1](json({ score: 0, vote: -1 }));
			await first;
			expect(requests()).toHaveLength(2);
			expect(state.voteOf('a')).toBe(-1);
			expect(state.list[0].score).toBe(0);
		});

		it('sends nothing more when the clicks end where the server already is', async () => {
			const { state, gates, requests } = await setup();
			const first = state.vote('a', 1);
			void state.vote('a', 1);
			void state.vote('a', 1);
			gates[0](json({ score: 2, vote: 1 }));
			await first;
			expect(requests()).toEqual(['PUT']);
			expect(state.voteOf('a')).toBe(1);
		});

		it('does not let a stale response overwrite a newer intent', async () => {
			const { state, gates } = await setup();
			const first = state.vote('a', 1);
			void state.vote('a', 1);
			expect(state.voteOf('a')).toBeNull();
			gates[0](json({ score: 2, vote: 1 }));
			await vi.waitFor(() => expect(gates).toHaveLength(2));
			expect(state.voteOf('a')).toBeNull();
			expect(state.list[0].score).toBe(1);
			gates[1](json({ score: 1, vote: null }));
			await first;
			expect(state.voteOf('a')).toBeNull();
		});

		it('rolls back to the last confirmed vote and score on failure, with a toast', async () => {
			const { state, gates } = await setup();
			const pending = state.vote('a', 1);
			void state.vote('a', -1);
			expect(state.list[0].score).toBe(0);
			gates[0](json({ message: 'Account muted' }, 403));
			await pending;
			expect(state.voteOf('a')).toBeNull();
			expect(state.list[0].score).toBe(1);
			expect(shown()).toEqual([expect.stringMatching(/^error: .*muted/)]);
		});

		it('rolls back to the earlier confirmed vote when the follow-up fails', async () => {
			const { state, gates } = await setup();
			const first = state.vote('a', 1);
			void state.vote('a', -1);
			gates[0](json({ score: 2, vote: 1 }));
			await vi.waitFor(() => expect(gates).toHaveLength(2));
			gates[1](json({ message: 'Too many' }, 429));
			await first;
			expect(state.voteOf('a')).toBe(1);
			expect(state.list[0].score).toBe(2);
			expect(shown()).toHaveLength(1);
		});
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

	it('toasts an edit by the status it answered, and a delete', async () => {
		const replies = [
			json({ comment: { ...OWN, id: 'a', status: 'published' } }),
			json({ comment: { ...OWN, id: 'a', status: 'pending' } }),
			json({ ok: true })
		];
		const state = new CommentsState('movie', '1', async () => replies.shift()!);
		expect(await state.edit('a', 'new text')).toBe(true);
		expect(await state.edit('a', 'newer text')).toBe(true);
		expect(await state.remove('a')).toBe(true);
		expect(shown()).toEqual([
			'success: Comment saved.',
			'warn: Comment saved. Only the author and moderators see the comment until a moderator decides.',
			'success: Comment deleted.'
		]);
	});

	it('says when the account had reported the comment before', async () => {
		const state = new CommentsState('movie', '1', async () => json({ alreadyReported: true }));
		expect(await state.report('a', { reason: 'spam', note: '  ' })).toBe(true);
		expect(shown()).toEqual(['success: This account already reported the comment.']);
	});
});
