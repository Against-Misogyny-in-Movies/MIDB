import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '#lib/server/db.ts';
import { users } from '#db/schema/auth.ts';
import { titles } from '#db/schema/titles.ts';
import { commentReports, comments } from '#db/schema/community.ts';
import { userValues } from '#db/test/users.ts';
import { PARENT_EXCERPT_MAX, listPendingQueue } from '#lib/server/data/moderation-queue.ts';
import { REJECT_MIN_SEVERITY } from '#lib/media/utils/comments.ts';
import { eq, sql } from 'drizzle-orm';

let titleRow: typeof titles.$inferSelect;

beforeEach(async () => {
	await db
		.insert(users)
		.values([
			userValues('author', { username: 'author' }),
			userValues('parent', { username: 'parent_author' })
		]);
	[titleRow] = await db
		.insert(titles)
		.values({ kind: 'movie', title: 'Alien', cleanTitle: 'alien', tmdbId: 348 })
		.returning();
});

async function write(userId: string, body: string, parentId?: string) {
	const id = crypto.randomUUID();
	await db.insert(comments).values({
		id,
		titleId: titleRow.id,
		userId,
		parentId: parentId ?? null,
		rootId: parentId ?? null,
		body,
		status: 'published'
	});
	if (parentId) {
		await db
			.update(comments)
			.set({ replyCount: sql`${comments.replyCount} + 1` })
			.where(eq(comments.id, parentId));
	}
	return id;
}

const hold = (id: string, verdict: Record<string, unknown> | null) =>
	db
		.update(comments)
		.set({ status: 'pending', aiVerdict: verdict ? JSON.stringify(verdict) : null })
		.where(eq(comments.id, id));

describe('the thread context of a queue item', () => {
	it('names the parent comment’s author and the start of its text', async () => {
		const parentId = await write('parent', 'x'.repeat(PARENT_EXCERPT_MAX + 40));
		const replyId = await write('author', 'A reply', parentId);
		await hold(replyId, null);
		const [item] = (await listPendingQueue()).items;
		expect(item.parent).toEqual({
			author: 'parent_author',
			authorId: 'parent',
			authorUsername: 'parent_author',
			excerpt: 'x'.repeat(PARENT_EXCERPT_MAX)
		});
		expect(item.comment.replyCount).toBe(0);
	});

	it('leaves a top-level comment with no parent and counts its replies', async () => {
		const topId = await write('author', 'A top-level comment');
		await write('parent', 'A reply', topId);
		await hold(topId, null);
		const [item] = (await listPendingQueue()).items;
		expect(item.parent).toBeNull();
		expect(item.comment.replyCount).toBe(1);
	});

	it('gives no excerpt for a parent the author deleted', async () => {
		const parentId = await write('parent', 'Gone soon');
		const replyId = await write('author', 'A reply', parentId);
		await hold(replyId, null);
		await db.update(comments).set({ status: 'deleted' }).where(eq(comments.id, parentId));
		const [item] = (await listPendingQueue()).items;
		expect(item.parent).toEqual({
			author: 'parent_author',
			authorId: 'parent',
			authorUsername: 'parent_author',
			excerpt: null
		});
	});
});

describe('the figures of the author', () => {
	it('count their withheld comments, the open reports against them and the day they joined', async () => {
		const held = await write('author', 'Held');
		const hidden = await write('author', 'Hidden');
		const rejected = await write('author', 'Rejected');
		await write('author', 'Fine');
		await db.update(comments).set({ status: 'hidden' }).where(eq(comments.id, hidden));
		await db.update(comments).set({ status: 'rejected' }).where(eq(comments.id, rejected));
		await hold(held, null);
		await db.insert(users).values(userValues('r1'));
		await db.insert(commentReports).values([
			{ commentId: held, reporterId: 'r1', reason: 'spam' },
			{ commentId: hidden, reporterId: 'r1', reason: 'hate', status: 'resolved' }
		]);
		const [item] = (await listPendingQueue()).items;
		expect(item).toMatchObject({
			authorCommentCount: 4,
			authorHiddenOrRejected: 2,
			authorOpenReportsAgainst: 1
		});
		expect(item.authorJoinedAt).toBe(
			(await db.select().from(users).where(eq(users.id, 'author')))[0].createdAt.toISOString()
		);
	});
});

describe('severe', () => {
	it('is true from the severity the classifier rejects at, false below it or without a verdict', async () => {
		const ids = [
			await write('author', 'High'),
			await write('author', 'Edge'),
			await write('author', 'Low'),
			await write('author', 'None')
		];
		await hold(ids[0], { severity: REJECT_MIN_SEVERITY + 1, categories: ['threat'] });
		await hold(ids[1], { severity: REJECT_MIN_SEVERITY, categories: [] });
		await hold(ids[2], { severity: REJECT_MIN_SEVERITY - 1, categories: [] });
		await hold(ids[3], null);
		const items = (await listPendingQueue()).items;
		const byBody = Object.fromEntries(items.map((i) => [i.comment.body, i.severe]));
		expect(byBody).toEqual({ High: true, Edge: true, Low: false, None: false });
	});
});
