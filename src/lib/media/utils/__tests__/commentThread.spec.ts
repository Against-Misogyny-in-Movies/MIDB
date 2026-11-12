import { describe, expect, it } from 'vitest';
import type { CommentView, OwnComment } from '#lib/media/types/comments.ts';
import type { PublicUser } from '#lib/media/types/user.ts';
import { buildThreads } from '#lib/media/utils/commentThread.ts';

const ME: PublicUser = {
	id: 'me',
	username: 'me',
	avatarKey: null,
	role: 'user',
	displayName: 'me'
};
const ANNA: PublicUser = { ...ME, id: 'anna', username: 'anna', displayName: 'anna' };

function view(id: string, over: Partial<CommentView> = {}): CommentView {
	return {
		id,
		parentId: null,
		rootId: null,
		inReplyTo: null,
		removed: false,
		body: `body ${id}`,
		author: ANNA,
		score: 0,
		replyCount: 0,
		createdAt: '2026-11-01T10:00:00.000Z',
		editedAt: null,
		replies: [],
		...over
	};
}

function own(id: string, over: Partial<OwnComment> = {}): OwnComment {
	return {
		id,
		parentId: null,
		rootId: null,
		body: `own ${id}`,
		status: 'pending',
		moderationSource: null,
		moderationReason: null,
		score: 0,
		replyCount: 0,
		createdAt: '2026-11-02T10:00:00.000Z',
		editedAt: null,
		...over
	};
}

describe('buildThreads', () => {
	it('returns the public threads as they are for a signed-out reader', () => {
		const reply = view('r', { parentId: 'a', rootId: 'a' });
		const threads = buildThreads([view('a', { replies: [reply] })], [], null);
		expect(threads.map((t) => [t.root.id, t.replies.map((r) => r.id)])).toEqual([['a', ['r']]]);
		expect(threads[0].root.review).toBeNull();
	});

	it('puts an own pending root first, with its state and the reader as author', () => {
		const threads = buildThreads([view('a')], [own('p')], ME);
		expect(threads.map((t) => t.root.id)).toEqual(['p', 'a']);
		expect(threads[0].root.review).toEqual({ status: 'pending', reason: null });
		expect(threads[0].root.author?.id).toBe('me');
	});

	it('carries the reason of a rejected comment', () => {
		const [thread] = buildThreads(
			[],
			[own('x', { status: 'rejected', moderationReason: 'Contains a slur' })],
			ME
		);
		expect(thread.root.review).toEqual({ status: 'rejected', reason: 'Contains a slur' });
	});

	it('joins an own reply to its root by age and names whom it answers', () => {
		const root = view('a', {
			replies: [
				view('r1', { parentId: 'a', rootId: 'a', createdAt: '2026-11-01T11:00:00.000Z' }),
				view('r2', { parentId: 'a', rootId: 'a', createdAt: '2026-11-03T11:00:00.000Z' })
			]
		});
		const [thread] = buildThreads(
			[root],
			[own('mine', { parentId: 'r1', rootId: 'a', createdAt: '2026-11-02T09:00:00.000Z' })],
			ME
		);
		expect(thread.replies.map((r) => r.id)).toEqual(['r1', 'mine', 'r2']);
		expect(thread.replies[1].inReplyTo).toEqual({ id: 'r1', displayName: 'anna' });
	});

	it('shows an own reply whose root is not loaded as a thread of its own', () => {
		const threads = buildThreads([view('a')], [own('lost', { parentId: 'zz', rootId: 'zz' })], ME);
		expect(threads.map((t) => t.root.id)).toEqual(['lost', 'a']);
	});

	it('replaces the placeholder of an edited comment that has replies, keeping its place and replies', () => {
		const reply = view('r', { parentId: 'a', rootId: 'a' });
		const placeholder = view('a', {
			removed: true,
			body: null,
			author: null,
			replyCount: 1,
			replies: [reply]
		});
		const threads = buildThreads(
			[view('first'), placeholder],
			[own('a', { body: 'Edited text', replyCount: 1 })],
			ME
		);
		expect(threads.map((t) => t.root.id)).toEqual(['first', 'a']);
		expect(threads[1].root).toMatchObject({
			body: 'Edited text',
			removed: false,
			review: { status: 'pending', reason: null }
		});
		expect(threads[1].replies.map((r) => r.id)).toEqual(['r']);
	});

	it('ignores own comments without a signed-in reader', () => {
		expect(buildThreads([view('a')], [own('p')], null).map((t) => t.root.id)).toEqual(['a']);
	});
});
