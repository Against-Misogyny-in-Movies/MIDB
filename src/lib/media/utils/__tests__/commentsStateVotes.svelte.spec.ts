import { afterEach, describe, expect, it, vi } from 'vitest';
import type { CommentView } from '#lib/media/types/comments.ts';
import { CommentsState } from '#lib/media/utils/commentsState.svelte.js';
import { toasts } from '#lib/media/utils/toasts.svelte.js';

afterEach(() => toasts.clear());

const shown = () => toasts.items.map((t) => `${t.tone}: ${t.text}`);

const view = (id: string, score = 1): CommentView => ({
	id,
	parentId: null,
	rootId: null,
	inReplyTo: null,
	removed: false,
	body: `body ${id}`,
	author: { id: 'anna', username: 'anna', avatarKey: null, role: 'user', displayName: 'anna' },
	score,
	replyCount: 0,
	createdAt: '2026-11-01T10:00:00.000Z',
	editedAt: null,
	replies: []
});

const json = (body: unknown, status = 200) =>
	new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

/** A state with comment `a` loaded; vote requests wait on a gate, viewer requests answer from `viewerReply`. */
async function setup(
	viewerReply: () => Response = () => json({ votes: {}, comments: [], mutedUntil: null })
) {
	const gates: Array<(reply: Response) => void> = [];
	const fetcher = vi.fn(async (url: unknown, init?: RequestInit) => {
		if (String(url).endsWith('/viewer')) return viewerReply();
		if (!init?.method || init.method === 'GET')
			return json({ comments: [view('a')], nextCursor: null });
		return new Promise<Response>((resolve) => gates.push(resolve));
	});
	const state = new CommentsState('movie', '1', fetcher);
	await state.load();
	const votes = () =>
		fetcher.mock.calls.filter((c) => c[1]?.method === 'PUT' || c[1]?.method === 'DELETE');
	return { state, gates, votes };
}

describe('CommentsState votes and the reader state', () => {
	it('sends no vote while the viewer state loads or failed to load', async () => {
		let release!: (r: Response) => void;
		const { state, votes } = await setup(
			() => new Promise<Response>((resolve) => (release = resolve)) as unknown as Response
		);
		const loading = state.loadViewer();
		await state.vote('a', 1);
		expect(votes()).toHaveLength(0);
		expect(state.voteOf('a')).toBeNull();
		expect(state.list[0].score).toBe(1);
		release(json({ message: 'Server error' }, 500));
		await loading;
		expect(state.viewerPhase).toBe('error');
		await state.vote('a', 1);
		expect(votes()).toHaveLength(0);
		expect(state.announcement).toBe('');
	});

	it('drops a vote reply that lands after signing out, with no follow-up and no toast', async () => {
		const { state, gates, votes } = await setup();
		await state.loadViewer();
		const pending = state.vote('a', 1);
		void state.vote('a', -1);
		state.clearViewer();
		gates[0](json({ score: 2, vote: 1 }));
		await pending;
		expect(votes()).toHaveLength(1);
		expect(state.viewer).toBeNull();
		expect(shown()).toEqual([]);
	});

	it('reloads the viewer state on a muted 403, so the section enters its muted state', async () => {
		const until = new Date(Date.now() + 3_600_000).toISOString();
		let muted = false;
		const { state, gates } = await setup(() =>
			json({ votes: {}, comments: [], mutedUntil: muted ? until : null })
		);
		await state.loadViewer();
		expect(state.mutedUntil).toBeNull();
		const pending = state.vote('a', 1);
		muted = true;
		gates[0](json({ message: 'Account muted' }, 403));
		await pending;
		await vi.waitFor(() => expect(state.mutedUntil).toBe(until));
		expect(shown()).toEqual([expect.stringMatching(/^error: .*muted/)]);
	});

	it('names the comment in a failed vote toast, and sets the status line from the press only', async () => {
		const { state, gates } = await setup();
		await state.loadViewer();
		const pending = state.vote('a', 1);
		expect(state.announcement).toBe('Score 2');
		gates[0](json({ score: 9, vote: 1 }));
		await pending;
		expect(state.announcement).toBe('Score 2');
		const failing = state.vote('a', -1);
		gates[1](json({ message: 'Server error' }, 500));
		await failing;
		expect(shown()).toEqual([
			'error: The vote on anna’s comment was not saved. Try again in a moment.'
		]);
	});
});
