import { beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { comments } from '#db/schema/community.ts';
import { db } from '#lib/server/db.ts';
import { users } from '#db/schema/auth.ts';
import { titles } from '#db/schema/titles.ts';
import { userValues } from '#db/test/users.ts';
import {
	createComment,
	getCommentThread,
	listTitleComments,
	softDeleteComment
} from '#lib/server/data/comment-queries.ts';
import { approveComment, hideComment, rejectComment } from '#lib/server/data/moderation-actions.ts';
import type { CommentStatus } from '#lib/media/types/comments.ts';
import type { TitleRow } from '#lib/server/data/title-queries.ts';
import type { UserRow } from '#lib/server/data/user-queries.ts';

let title: TitleRow;
let mod: UserRow;

const viewers = {
	anonymous: null,
	other: { id: 'other', role: 'user' },
	author: { id: 'author', role: 'user' },
	moderator: { id: 'mod', role: 'moderator' },
	administrator: { id: 'admin', role: 'administrator' }
} as const;

beforeEach(async () => {
	for (const id of ['author', 'other', 'replier']) await db.insert(users).values(userValues(id));
	await db.insert(users).values(userValues('mod', { role: 'moderator' }));
	await db.insert(users).values(userValues('admin', { role: 'administrator' }));
	[mod] = await db.select().from(users).where(eq(users.id, 'mod'));
	[title] = await db
		.insert(titles)
		.values({ kind: 'movie', title: 'Alien', cleanTitle: 'alien', tmdbId: 348 })
		.returning();
});

/** Stores a comment (pending through the seam), then publishes it when asked. */
async function store(userId: string, body: string, parentId?: string, publish = true) {
	const result = await createComment({ title, userId, body, parentId });
	if (!result.ok) throw new Error(result.reason);
	if (publish) await approveComment(mod, result.comment.id, null);
	return result.comment.id;
}

describe('getCommentThread', () => {
	it('answers null for a comment that does not exist', async () => {
		expect(await getCommentThread('missing', viewers.moderator)).toBeNull();
	});

	it('gives anyone a published comment with its root and published replies, oldest first', async () => {
		const root = await store('author', 'Root');
		const first = await store('replier', 'First', root);
		const second = await store('other', 'Second', first);
		await store('other', 'Held reply', root, false);

		for (const viewer of Object.values(viewers)) {
			const thread = await getCommentThread(second, viewer);
			expect(thread?.review).toBeNull();
			expect(thread?.root).toMatchObject({ id: root, body: 'Root', removed: false });
			expect(thread?.root.replies.map((r) => r.id)).toEqual([first, second]);
			expect(thread?.root.replies[1].inReplyTo).toMatchObject({ id: first });
		}
	});

	it('names the title the thread is on, from any comment in it', async () => {
		const [other] = await db
			.insert(titles)
			.values({ kind: 'tv', title: 'Dark', cleanTitle: 'dark', tmdbId: 70523 })
			.returning();
		const result = await createComment({ title: other, userId: 'author', body: 'On a series' });
		if (!result.ok) throw new Error(result.reason);
		await approveComment(mod, result.comment.id, null);
		const root = await store('author', 'Root');
		const reply = await store('replier', 'Reply', root);
		expect(await getCommentThread(reply, null)).toMatchObject({ kind: 'movie', tmdbId: 348 });
		expect(await getCommentThread(result.comment.id, null)).toMatchObject({
			kind: 'tv',
			tmdbId: 70523
		});
	});

	it('returns the same thread for the root and for any reply in it', async () => {
		const root = await store('author', 'Root');
		const reply = await store('replier', 'Reply', root);
		expect(await getCommentThread(root, null)).toEqual(await getCommentThread(reply, null));
	});

	it('carries no email and the public user only', async () => {
		const root = await store('author', 'Root');
		const json = JSON.stringify(await getCommentThread(root, null));
		expect(json).not.toContain('@example.com');
		expect(json).toContain('"username"');
	});

	const moves: [CommentStatus, (id: string) => Promise<unknown>][] = [
		['pending', async () => undefined],
		['hidden', (id) => hideComment(mod, id, 'off topic')],
		['rejected', (id) => rejectComment(mod, id, 'spam')],
		['deleted', (id) => softDeleteComment(id, 'author')]
	];
	describe.each(moves)('a %s comment', (status, move) => {
		let id: string;
		beforeEach(async () => {
			id = await store('author', 'Hidden words', undefined, status !== 'pending');
			await move(id);
		});

		it.each([
			['anonymous', false],
			['other', false],
			['author', true],
			['moderator', true],
			['administrator', true]
		] as const)('is %s-visible: %s', async (who, visible) => {
			const thread = await getCommentThread(id, viewers[who]);
			if (!visible) return expect(thread).toBeNull();
			expect(thread?.review?.status).toBe(status);
			expect(thread?.root).toMatchObject({ id, body: 'Hidden words', removed: false });
			expect(thread?.root.author?.id).toBe('author');
		});
	});

	it('carries the moderation reason of a rejected comment to those who may read it', async () => {
		const id = await store('author', 'Words', undefined, false);
		await rejectComment(mod, id, 'spam');
		expect((await getCommentThread(id, viewers.author))?.review).toEqual({
			status: 'rejected',
			reason: 'spam'
		});
	});

	it('shows only the linked comment unredacted: a pending sibling stays out, a hidden root is a placeholder', async () => {
		const root = await store('author', 'Root');
		const reply = await store('replier', 'Visible reply', root);
		await store('other', 'Pending sibling', root, false);
		await hideComment(mod, root, null);

		const thread = await getCommentThread(reply, viewers.moderator);
		expect(thread?.review).toBeNull();
		expect(thread?.root).toMatchObject({ id: root, removed: true, body: null, author: null });
		expect(thread?.root.replies.map((r) => r.id)).toEqual([reply]);
	});

	it('shows a linked pending reply under its published root to its author and to staff only', async () => {
		const root = await store('author', 'Root');
		const pending = await store('replier', 'Waiting', root, false);
		expect(await getCommentThread(pending, viewers.other)).toBeNull();
		const own = await getCommentThread(pending, { id: 'replier', role: 'user' });
		expect(own?.review?.status).toBe('pending');
		expect(own?.root.replies.map((r) => [r.id, r.body])).toEqual([[pending, 'Waiting']]);
		expect((await getCommentThread(pending, viewers.administrator))?.review?.status).toBe(
			'pending'
		);
	});
});

describe('comment times', () => {
	const EXACT = new Date('2026-11-01T10:07:42.123Z');
	const EDITED = new Date('2026-11-01T10:09:59.999Z');

	async function stamped() {
		const root = await store('author', 'Root');
		const reply = await store('replier', 'Reply', root);
		await db.update(comments).set({ createdAt: EXACT, editedAt: EDITED });
		return { root, reply };
	}

	it('rounds the public list down to the minute and keeps the cursor exact', async () => {
		const { root, reply } = await stamped();
		const { comments: list } = await listTitleComments(title.id, {
			sort: 'new',
			limit: 1
		});
		expect(list[0]).toMatchObject({
			id: root,
			createdAt: '2026-11-01T10:07:00.000Z',
			editedAt: '2026-11-01T10:09:00.000Z'
		});
		expect(list[0].replies[0]).toMatchObject({ id: reply, createdAt: '2026-11-01T10:07:00.000Z' });
	});

	it.each(['anonymous', 'other'] as const)('rounds a thread for %s', async (who) => {
		const { reply } = await stamped();
		const thread = await getCommentThread(reply, viewers[who]);
		expect(thread?.root.createdAt).toBe('2026-11-01T10:07:00.000Z');
		expect(thread?.root.replies[0].createdAt).toBe('2026-11-01T10:07:00.000Z');
		expect(thread?.root.replies[0].editedAt).toBe('2026-11-01T10:09:00.000Z');
	});

	it("keeps an author's own comments exact and rounds everyone else's", async () => {
		const { reply } = await stamped();
		const thread = await getCommentThread(reply, viewers.author);
		expect(thread?.root.createdAt).toBe(EXACT.toISOString());
		expect(thread?.root.replies[0].createdAt).toBe('2026-11-01T10:07:00.000Z');
	});

	it.each(['moderator', 'administrator'] as const)('keeps every time exact for %s', async (who) => {
		const { reply } = await stamped();
		const thread = await getCommentThread(reply, viewers[who]);
		expect(thread?.root.createdAt).toBe(EXACT.toISOString());
		expect(thread?.root.editedAt).toBe(EDITED.toISOString());
		expect(thread?.root.replies[0].createdAt).toBe(EXACT.toISOString());
	});
});
