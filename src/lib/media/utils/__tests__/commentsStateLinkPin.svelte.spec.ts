import { describe, expect, it, vi } from 'vitest';
import type { CommentThread, CommentView } from '#lib/media/types/comments.ts';
import { CommentsState } from '#lib/media/utils/commentsState.svelte.js';

const view = (id: string, over: Partial<CommentView> = {}): CommentView => ({
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
});

const json = (body: unknown, status = 200) =>
	new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

const thread = (root: CommentView, over: Partial<CommentThread> = {}): CommentThread => ({
	kind: 'movie',
	tmdbId: 1,
	root,
	review: null,
	...over
});

const placeholder = view('gone', { removed: true, body: null, author: null, replyCount: 1 });

describe('CommentsState.showLink on a placeholder', () => {
	function setup(answer: Response) {
		const fetcher = vi.fn(async (input: string) =>
			input.includes('/comments?')
				? json({ comments: [placeholder, view('b')], nextCursor: null })
				: answer.clone()
		);
		return { state: new CommentsState('movie', '1', fetcher), fetcher };
	}

	it('fetches the thread, so its author or staff see the comment with its status', async () => {
		const review = { status: 'hidden' as const, reason: 'off topic' };
		const { state, fetcher } = setup(json(thread(view('gone'), { review })));
		await state.load();
		expect(await state.showLink('gone')).toBe(true);
		expect(fetcher).toHaveBeenCalledWith('/api/comments/gone', expect.anything());
		expect(state.linked).toMatchObject({ id: 'gone', review, root: { removed: false } });
	});

	it('keeps the placeholder for everyone else, with no notice', async () => {
		const { state } = setup(json({ message: 'Not found' }, 404));
		await state.load();
		expect(await state.showLink('gone')).toBe(true);
		expect(state.linked).toBeNull();
		expect(state.errors.link).toBeUndefined();
	});

	it('does not fetch for a published comment on the loaded page', async () => {
		const { state, fetcher } = setup(json({}, 500));
		await state.load();
		expect(await state.showLink('b')).toBe(true);
		expect(fetcher).toHaveBeenCalledTimes(1);
	});
});

describe('CommentsState.showLink on another title', () => {
	const open = (answer: CommentThread) =>
		new CommentsState('movie', '1', async (input: string) =>
			input.includes('/comments?') ? json({ comments: [], nextCursor: null }) : json(answer)
		);

	it.each([
		['kind', { kind: 'tv' as const }],
		['TMDB id', { tmdbId: 5 }]
	])('treats a thread with another %s as not available', async (_, other) => {
		const state = open(thread(view('far'), other));
		await state.load();
		expect(await state.showLink('far')).toBe(false);
		expect(state.errors.link).toBe('This comment is not available.');
		expect(state.linkRetryable).toBe(false);
		expect(state.linked).toBeNull();
	});

	it('drops an earlier pin when a later link is not available, and offers a retry only after a failure', async () => {
		let answer: Response = json(thread(view('far')));
		const state = new CommentsState('movie', '1', async (input: string) =>
			input.includes('/comments?') ? json({ comments: [], nextCursor: null }) : answer.clone()
		);
		await state.load();
		await state.showLink('far');
		expect(state.linked?.id).toBe('far');
		answer = json({}, 503);
		expect(await state.showLink('other')).toBe(false);
		expect(state.linked).toBeNull();
		expect(state.linkRetryable).toBe(true);
		expect(state.busy.link).toBe(false);
	});
});

describe('CommentsState with the pinned root on a loaded page too', () => {
	/** `far` is pinned; a later page brings `far` again as a second object. */
	async function pinned() {
		const fetcher = vi.fn(async (input: string, init?: RequestInit) => {
			if (input.includes('cursor=')) {
				return json({ comments: [view('far', { score: 1 }), view('b')], nextCursor: null });
			}
			if (input.includes('/comments?')) return json({ comments: [view('a')], nextCursor: 'two' });
			if (input.endsWith('/viewer')) {
				return json({ votes: {}, scores: {}, comments: [], mutedUntil: null });
			}
			if (init?.method === 'DELETE') return json({ ok: true });
			if (init?.method === 'PUT') return json({ score: 2, vote: 1 });
			if (init?.method === 'PATCH') {
				return json({
					comment: {
						id: 'far',
						parentId: null,
						rootId: null,
						body: 'Edited words',
						status: 'published',
						moderationSource: null,
						moderationReason: null,
						score: 1,
						replyCount: 0,
						createdAt: '2026-11-01T10:00:00.000Z',
						editedAt: '2026-11-02T10:00:00.000Z'
					}
				});
			}
			return json(thread(view('far')));
		});
		const state = new CommentsState('movie', '1', fetcher);
		await state.load();
		await state.loadViewer();
		await state.showLink('far');
		await state.loadMore();
		return state;
	}

	it('shows a vote and an edit on the copy drawn once another link clears the pin', async () => {
		const state = await pinned();
		await state.vote('far', 1);
		await state.edit('far', 'Edited words');
		expect(await state.showLink('a')).toBe(true);
		expect(state.linked).toBeNull();
		const far = state.list.find((c) => c.id === 'far');
		expect(far).toMatchObject({ score: 2, body: 'Edited words' });
		expect(far?.editedAt).toBe('2026-11-02T10:00:00.000Z');
	});

	it('turns every copy into a placeholder when a root with replies is deleted', async () => {
		const state = await pinned();
		const copies = [state.linked?.root, state.list.find((c) => c.id === 'far')];
		for (const copy of copies) if (copy) copy.replyCount = 1;
		await state.remove('far');
		for (const copy of copies) expect(copy).toMatchObject({ removed: true, body: null });
	});
});
