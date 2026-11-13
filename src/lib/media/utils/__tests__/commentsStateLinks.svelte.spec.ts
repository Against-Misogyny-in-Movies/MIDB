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

const thread = (root: CommentView, review: CommentThread['review'] = null): CommentThread => ({
	kind: 'movie',
	tmdbId: 1,
	root,
	review
});

/** Page one holds `a`; the thread endpoint answers from `threads`, anything else is a 404. */
function setup(threads: Record<string, Response> = {}) {
	const calls: string[] = [];
	let releaseList!: () => void;
	const listGate = new Promise<void>((resolve) => (releaseList = resolve));
	const fetcher = vi.fn(async (input: string) => {
		calls.push(input);
		if (input.includes('/comments?')) {
			await listGate;
			return json({
				comments: [view('a', { replies: [view('ar', { parentId: 'a', rootId: 'a' })] })],
				nextCursor: 'next'
			});
		}
		const id = input.split('/').pop() as string;
		return threads[id]?.clone() ?? json({ message: 'Not found' }, 404);
	});
	const state = new CommentsState('movie', '1', fetcher);
	const threadCalls = () => calls.filter((c) => c.startsWith('/api/comments/'));
	return { state, releaseList, threadCalls };
}

describe('CommentsState.showLink', () => {
	it('fetches nothing for a comment, or a reply, on the loaded page', async () => {
		const { state, releaseList, threadCalls } = setup();
		const load = state.load();
		releaseList();
		await load;
		expect(await state.showLink('a')).toBe(true);
		expect(await state.showLink('ar')).toBe(true);
		expect(threadCalls()).toEqual([]);
		expect(state.linked).toBeNull();
	});

	it('waits for the first page before it decides to fetch a thread', async () => {
		const { state, releaseList, threadCalls } = setup();
		void state.load();
		const shown = state.showLink('a');
		await Promise.resolve();
		expect(threadCalls()).toEqual([]);
		expect(state.busy.link).toBeFalsy();
		releaseList();
		expect(await shown).toBe(true);
		expect(threadCalls()).toEqual([]);
		expect(state.busy.link).toBe(false);
	});

	it('pins the thread of a comment that is not on the loaded page', async () => {
		const review = { status: 'pending' as const, reason: null };
		const { state, releaseList, threadCalls } = setup({
			far: json(thread(view('far'), review))
		});
		const load = state.load();
		releaseList();
		await load;
		expect(await state.showLink('far')).toBe(true);
		expect(threadCalls()).toEqual(['/api/comments/far']);
		expect(state.linked).toMatchObject({ id: 'far', root: { id: 'far' }, review });
		expect(state.busy.link).toBe(false);
	});

	it('does not fetch a pinned thread again, and drops the pin when a link points into the list', async () => {
		const { state, releaseList, threadCalls } = setup({ far: json(thread(view('far'))) });
		const load = state.load();
		releaseList();
		await load;
		await state.showLink('far');
		await state.showLink('far');
		expect(threadCalls()).toHaveLength(1);
		await state.showLink('a');
		expect(state.linked).toBeNull();
	});

	it('says the comment is not available on a 404, and words other failures', async () => {
		const { state, releaseList } = setup();
		const load = state.load();
		releaseList();
		await load;
		expect(await state.showLink('gone')).toBe(false);
		expect(state.errors.link).toBe('This comment is not available.');
		expect(state.linked).toBeNull();
		expect(state.busy.link).toBe(false);

		const failing = new CommentsState('movie', '1', async (input: string) =>
			input.includes('/comments?') ? json({ comments: [], nextCursor: null }) : json({}, 429)
		);
		await failing.load();
		expect(await failing.showLink('x')).toBe(false);
		expect(failing.errors.link).toMatch(/linked comment could not be loaded. Too many requests/);
	});

	it('keeps the newest link when an older request answers late', async () => {
		let releaseOld!: (r: Response) => void;
		const fetcher = vi.fn(async (input: string) => {
			if (input.includes('/comments?')) return json({ comments: [], nextCursor: null });
			if (input.endsWith('/old')) return new Promise<Response>((resolve) => (releaseOld = resolve));
			return json(thread(view('new')));
		});
		const state = new CommentsState('movie', '1', fetcher);
		await state.load();
		const old = state.showLink('old');
		await vi.waitFor(() => expect(releaseOld).toBeTypeOf('function'));
		await state.showLink('new');
		releaseOld(json(thread(view('old'))));
		expect(await old).toBe(false);
		expect(state.linked?.id).toBe('new');
	});

	it('shows the viewer scores over the pinned thread, and votes on its comments', async () => {
		const fetcher = vi.fn(async (input: string, init?: RequestInit) => {
			if (input.includes('/comments?')) return json({ comments: [], nextCursor: null });
			if (input.endsWith('/viewer'))
				return json({ votes: { far: 1 }, scores: { far: 9 }, comments: [], mutedUntil: null });
			if (init?.method === 'PUT') return json({ score: 10, vote: -1 });
			return json(thread(view('far', { score: 4 })));
		});
		const state = new CommentsState('movie', '1', fetcher);
		await state.load();
		await state.showLink('far');
		await state.loadViewer();
		expect(state.linked?.root.score).toBe(9);
		await state.vote('far', -1);
		expect(state.linked?.root.score).toBe(10);
		expect(state.voteOf('far')).toBe(-1);
	});

	it('drops the pin when the author deletes its root', async () => {
		const fetcher = vi.fn(async (input: string, init?: RequestInit) => {
			if (input.includes('/comments?')) return json({ comments: [], nextCursor: null });
			if (init?.method === 'DELETE') return json({ ok: true });
			return json(thread(view('far')));
		});
		const state = new CommentsState('movie', '1', fetcher);
		await state.load();
		await state.showLink('far');
		await state.remove('far');
		expect(state.linked).toBeNull();
	});
});
