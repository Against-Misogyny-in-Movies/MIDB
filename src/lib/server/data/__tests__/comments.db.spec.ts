import { describe, it, expect, beforeEach } from 'vitest';
import { eq } from 'drizzle-orm';
import { db } from '#lib/server/db.ts';
import { users } from '#db/schema/auth.ts';
import { titles } from '#db/schema/titles.ts';
import { commentReports, commentVotes, comments } from '#db/schema/community.ts';
import { userValues } from '#db/test/users.ts';
import {
	createComment,
	editComment,
	getViewerCommentState,
	listTitleComments,
	softDeleteComment,
	type CommentRow
} from '#lib/server/data/comment-queries.ts';
import { removeVote, setVote } from '#lib/server/data/comment-votes.ts';
import { getUserComments } from '#lib/server/data/user-queries.ts';
import { reportComment } from '#lib/server/data/comment-reports.ts';
import {
	approveComment,
	dismissReports,
	hideComment,
	rejectComment,
	restoreComment
} from '#lib/server/data/moderation-actions.ts';
import { listReportedQueue } from '#lib/server/data/moderation-queue.ts';
import type { UserRow } from '#lib/server/data/user-queries.ts';
import type { TitleRow } from '#lib/server/data/title-queries.ts';

let title: TitleRow;
let mod: UserRow;

beforeEach(async () => {
	for (const id of ['author', 'u1', 'u2', 'u3', 'u4'])
		await db.insert(users).values(userValues(id));
	await db.insert(users).values(userValues('mod', { role: 'moderator' }));
	await db.insert(users).values(userValues('admin', { role: 'administrator' }));
	[mod] = await db.select().from(users).where(eq(users.id, 'mod'));
	[title] = await db
		.insert(titles)
		.values({ kind: 'movie', title: 'Alien', cleanTitle: 'alien', tmdbId: 348 })
		.returning();
});

const row = async (id: string): Promise<CommentRow> =>
	(await db.select().from(comments).where(eq(comments.id, id)))[0];

/** Stores a comment, then publishes it directly: the seam holds new comments for review. */
async function published(userId: string, body: string, parentId?: string): Promise<string> {
	const result = await createComment({ title, userId, body, parentId });
	if (!result.ok) throw new Error(result.reason);
	const id = result.comment.id;
	await approveComment(mod, id);
	return id;
}

describe('createComment', () => {
	it('stores a comment as pending through the moderation seam', async () => {
		const result = await createComment({ title, userId: 'author', body: 'First' });
		expect(result).toMatchObject({ ok: true, comment: { status: 'pending', body: 'First' } });
		expect(await row((result as { comment: { id: string } }).comment.id)).toMatchObject({
			moderationSource: null,
			score: 0,
			replyCount: 0,
			parentId: null,
			rootId: null
		});
	});

	it('files a reply to a reply under the root and keeps who it answers', async () => {
		const root = await published('author', 'Root');
		const reply = await published('u1', 'Reply', root);
		const deeper = await published('u2', 'Deeper', reply);
		expect(await row(deeper)).toMatchObject({ parentId: reply, rootId: root });
		expect(await row(reply)).toMatchObject({ parentId: root, rootId: root });
	});

	it('refuses a reply to a pending or missing comment, or one on another title', async () => {
		const pending = await createComment({ title, userId: 'author', body: 'Waiting' });
		const pendingId = (pending as { comment: { id: string } }).comment.id;
		expect(await createComment({ title, userId: 'u1', body: 'x', parentId: pendingId })).toEqual({
			ok: false,
			reason: 'parent-not-found'
		});
		expect(await createComment({ title, userId: 'u1', body: 'x', parentId: 'nope' })).toEqual({
			ok: false,
			reason: 'parent-not-found'
		});
		const [other] = await db
			.insert(titles)
			.values({ kind: 'movie', title: 'Aliens', cleanTitle: 'aliens', tmdbId: 679 })
			.returning();
		const root = await published('author', 'Root');
		expect(await createComment({ title: other, userId: 'u1', body: 'x', parentId: root })).toEqual({
			ok: false,
			reason: 'parent-not-found'
		});
	});

	it('rejects an empty or over-long body in the database', async () => {
		await expect(
			db.insert(comments).values({ titleId: title.id, userId: 'u1', body: '' })
		).rejects.toThrow();
		await expect(
			db.insert(comments).values({ titleId: title.id, userId: 'u1', body: 'x'.repeat(5001) })
		).rejects.toThrow();
		await db.insert(comments).values({ titleId: title.id, userId: 'u1', body: 'x'.repeat(5000) });
	});
});

describe('threading and reply counts', () => {
	it('counts published replies on the parent and the root, and drops them on a move out', async () => {
		const root = await published('author', 'Root');
		const reply = await published('u1', 'Reply', root);
		await published('u2', 'Deeper', reply);
		expect((await row(root)).replyCount).toBe(2);
		expect((await row(reply)).replyCount).toBe(1);

		await hideComment(mod, reply, 'off topic');
		expect((await row(root)).replyCount).toBe(1);
		await restoreComment(mod, reply);
		expect((await row(root)).replyCount).toBe(2);
	});

	it('does not count a pending reply', async () => {
		const root = await published('author', 'Root');
		await createComment({ title, userId: 'u1', body: 'Waiting', parentId: root });
		expect((await row(root)).replyCount).toBe(0);
	});

	it('lists roots with one rendered level of replies, oldest first, and "in reply to"', async () => {
		const root = await published('author', 'Root');
		const reply = await published('u1', 'Reply', root);
		await published('u2', 'Deeper', reply);
		const { comments: list } = await listTitleComments(title.id, { sort: 'new' });
		expect(list).toHaveLength(1);
		expect(list[0].replies.map((r) => r.body)).toEqual(['Reply', 'Deeper']);
		expect(list[0].replies[0].inReplyTo).toBeNull();
		expect(list[0].replies[1].inReplyTo).toEqual({ id: reply, displayName: expect.any(String) });
	});

	it('pages roots in newest order and in score order with a cursor', async () => {
		const ids: string[] = [];
		for (let i = 0; i < 5; i++) {
			ids.push(await published('author', `Comment ${i}`));
			await new Promise((r) => setTimeout(r, 2));
		}
		await setVote(ids[1], 'u1', 1);
		await setVote(ids[1], 'u2', 1);
		await setVote(ids[3], 'u1', 1);

		const first = await listTitleComments(title.id, { sort: 'new', limit: 2 });
		expect(first.comments.map((c) => c.body)).toEqual(['Comment 4', 'Comment 3']);
		const second = await listTitleComments(title.id, {
			sort: 'new',
			limit: 2,
			cursor: first.nextCursor
		});
		expect(second.comments.map((c) => c.body)).toEqual(['Comment 2', 'Comment 1']);
		const third = await listTitleComments(title.id, {
			sort: 'new',
			limit: 2,
			cursor: second.nextCursor
		});
		expect(third.comments.map((c) => c.body)).toEqual(['Comment 0']);
		expect(third.nextCursor).toBeNull();

		const top = await listTitleComments(title.id, { sort: 'top', limit: 3 });
		expect(top.comments.map((c) => c.body)).toEqual(['Comment 1', 'Comment 3', 'Comment 4']);
		const rest = await listTitleComments(title.id, {
			sort: 'top',
			limit: 3,
			cursor: top.nextCursor
		});
		expect(rest.comments.map((c) => c.body)).toEqual(['Comment 2', 'Comment 0']);
	});
});

describe('the public list cursor', () => {
	it('reads a cursor with an out-of-range date as the first page', async () => {
		await published('author', 'One');
		const first = await listTitleComments(title.id, { sort: 'new' });
		for (const sort of ['new', 'top'] as const) {
			const cursor = sort === 'top' ? '0.99999999999999999999.abc' : '99999999999999999999.abc';
			const page = await listTitleComments(title.id, { sort, cursor });
			expect(page.comments.map((c) => c.id)).toEqual(first.comments.map((c) => c.id));
		}
	});
});

describe('the public list', () => {
	it('excludes pending and rejected comments', async () => {
		await published('author', 'Shown');
		await createComment({ title, userId: 'u1', body: 'Pending' });
		const rejected = await published('u2', 'Rejected');
		await rejectComment(mod, rejected, 'spam');
		const { comments: list } = await listTitleComments(title.id, { sort: 'new' });
		expect(list.map((c) => c.body)).toEqual(['Shown']);
	});

	it('shows no author email or user row, only the public fields', async () => {
		await published('author', 'Shown');
		const { comments: list } = await listTitleComments(title.id, { sort: 'new' });
		expect(Object.keys(list[0].author ?? {}).sort()).toEqual([
			'avatarKey',
			'displayName',
			'id',
			'role',
			'username'
		]);
	});

	it('writes nothing on a read', async () => {
		await published('author', 'Shown');
		const before = await db.select().from(comments);
		await listTitleComments(title.id, { sort: 'top' });
		await getViewerCommentState(title.id, 'u1');
		expect(await db.select().from(comments)).toEqual(before);
	});
});

describe('soft delete', () => {
	it('keeps replies: a deleted comment with replies comes back as a bodiless placeholder', async () => {
		const root = await published('author', 'Root');
		await published('u1', 'Reply', root);
		expect(await softDeleteComment(root, 'author')).toMatchObject({ ok: true });
		expect((await row(root)).status).toBe('deleted');

		const { comments: list } = await listTitleComments(title.id, { sort: 'new' });
		expect(list).toHaveLength(1);
		expect(list[0]).toMatchObject({ id: root, removed: true, body: null, author: null });
		expect(list[0].replies.map((r) => r.body)).toEqual(['Reply']);
	});

	it('drops a deleted comment without replies from the list', async () => {
		const root = await published('author', 'Root');
		await softDeleteComment(root, 'author');
		expect((await listTitleComments(title.id, { sort: 'new' })).comments).toEqual([]);
	});

	it('is the author only', async () => {
		const root = await published('author', 'Root');
		expect(await softDeleteComment(root, 'u1')).toEqual({ ok: false, reason: 'forbidden' });
		expect(await softDeleteComment('missing', 'u1')).toEqual({ ok: false, reason: 'not-found' });
	});
});

describe('editComment', () => {
	it('sets edited_at, runs moderation again and drops a published comment out of the counts', async () => {
		const root = await published('author', 'Root');
		const reply = await published('u1', 'Reply', root);
		expect((await row(root)).replyCount).toBe(1);

		const result = await editComment(reply, 'u1', 'Reply, edited');
		expect(result).toMatchObject({
			ok: true,
			comment: { status: 'pending', body: 'Reply, edited' }
		});
		const after = await row(reply);
		expect(after.editedAt).toBeInstanceOf(Date);
		expect((await row(root)).replyCount).toBe(0);
	});

	it('is the author only, and refuses a hidden or deleted comment', async () => {
		const id = await published('author', 'Root');
		expect(await editComment(id, 'u1', 'Mine now')).toEqual({ ok: false, reason: 'forbidden' });
		await hideComment(mod, id, null);
		expect(await editComment(id, 'author', 'Back')).toEqual({ ok: false, reason: 'not-editable' });
	});

	it('leaves an unchanged body alone', async () => {
		const id = await published('author', 'Root');
		await editComment(id, 'author', 'Root');
		expect(await row(id)).toMatchObject({ status: 'published', editedAt: null });
	});
});

describe('votes', () => {
	it('keeps the score equal to the sum of the votes through set, flip, repeat and remove', async () => {
		const id = await published('author', 'Root');
		expect(await setVote(id, 'u1', 1)).toMatchObject({ ok: true, score: 1 });
		expect(await setVote(id, 'u1', 1)).toMatchObject({ score: 1 });
		expect(await setVote(id, 'u2', 1)).toMatchObject({ score: 2 });
		expect(await setVote(id, 'u1', -1)).toMatchObject({ score: 0 });
		expect(await setVote(id, 'u3', -1)).toMatchObject({ score: -1 });
		expect(await removeVote(id, 'u3')).toMatchObject({ score: 0, vote: null });
		expect(await removeVote(id, 'u3')).toMatchObject({ score: 0 });
		const votes = await db.select().from(commentVotes).where(eq(commentVotes.commentId, id));
		expect(votes.reduce((sum, v) => sum + v.value, 0)).toBe((await row(id)).score);
		expect((await row(id)).score).toBe(0);
	});

	it('refuses a vote on your own comment, on a pending one, and on a missing one', async () => {
		const id = await published('author', 'Root');
		expect(await setVote(id, 'author', 1)).toEqual({ ok: false, reason: 'own-comment' });
		const pending = await createComment({ title, userId: 'author', body: 'Waiting' });
		const pendingId = (pending as { comment: { id: string } }).comment.id;
		expect(await setVote(pendingId, 'u1', 1)).toEqual({ ok: false, reason: 'not-found' });
		expect(await removeVote('missing', 'u1')).toEqual({ ok: false, reason: 'not-found' });
	});

	it('does not touch updated_at', async () => {
		const id = await published('author', 'Root');
		const before = (await row(id)).updatedAt;
		await setVote(id, 'u1', 1);
		expect((await row(id)).updatedAt).toEqual(before);
	});

	it('reports a reader their votes and pending and rejected comments, newest first', async () => {
		const shown = await published('author', 'Shown');
		await setVote(shown, 'u1', -1);
		const first = await createComment({ title, userId: 'u1', body: 'Waiting' });
		const second = await published('u1', 'Rejected soon');
		await rejectComment(mod, second, 'spam');
		const state = await getViewerCommentState(title.id, 'u1');
		expect(state.votes).toEqual({ [shown]: -1 });
		expect(state.comments.map((c) => c.status).sort()).toEqual(['pending', 'rejected']);
		expect(state.comments.find((c) => c.status === 'rejected')?.moderationReason).toBe('spam');
		expect(
			state.comments.some((c) => c.id === (first as { comment: { id: string } }).comment.id)
		).toBe(true);
		expect((await getViewerCommentState(title.id, 'u2')).comments).toEqual([]);
	});
});

describe('reports', () => {
	it('moves a published comment to pending on the third distinct open report', async () => {
		const root = await published('author', 'Root');
		const reply = await published('u1', 'Reply', root);
		expect((await row(root)).replyCount).toBe(1);

		const report = (reporterId: string) =>
			reportComment({ commentId: reply, reporterId, reason: 'spam' });
		expect(await report('u2')).toMatchObject({ ok: true, status: 'published' });
		expect(await report('u2')).toMatchObject({ alreadyReported: true });
		expect(await report('u3')).toMatchObject({ status: 'published' });
		expect((await row(reply)).status).toBe('published');
		expect(await report('u4')).toMatchObject({ ok: true, status: 'pending' });

		expect(await row(reply)).toMatchObject({ status: 'pending', moderationSource: 'reports' });
		expect((await row(root)).replyCount).toBe(0);
		expect(
			(await db.select().from(commentReports).where(eq(commentReports.commentId, reply))).length
		).toBe(3);
	});

	it('refuses a report from the author and of a comment that is not published', async () => {
		const id = await published('author', 'Root');
		expect(await reportComment({ commentId: id, reporterId: 'author', reason: 'spam' })).toEqual({
			ok: false,
			reason: 'own-comment'
		});
		const pending = await createComment({ title, userId: 'author', body: 'Waiting' });
		expect(
			await reportComment({
				commentId: (pending as { comment: { id: string } }).comment.id,
				reporterId: 'u1',
				reason: 'spam'
			})
		).toEqual({ ok: false, reason: 'not-found' });
	});

	it('dismissing the reports restores a comment the reports sent to review', async () => {
		const id = await published('author', 'Root');
		for (const reporterId of ['u1', 'u2', 'u3']) {
			await reportComment({ commentId: id, reporterId, reason: 'hate', note: 'no' });
		}
		expect((await row(id)).status).toBe('pending');
		const [queued] = await listReportedQueue();
		expect(queued.reports).toHaveLength(3);

		expect(await dismissReports(mod, id)).toMatchObject({ ok: true });
		expect(await row(id)).toMatchObject({ status: 'published', moderationSource: null });
		expect(await dismissReports(mod, id)).toEqual({ ok: false, reason: 'invalid-state' });
		const statuses = await db.select({ s: commentReports.status }).from(commentReports);
		expect(statuses.every((r) => r.s === 'dismissed')).toBe(true);
	});
});

describe('getUserComments', () => {
	it('returns the reader’s comments in every status, newest first, with the title', async () => {
		const pending = await createComment({ title, userId: 'author', body: 'Pending one' });
		const ok = await published('author', 'Published one');
		const gone = await published('author', 'Deleted one');
		await softDeleteComment(gone, 'author');
		const rejected = await published('author', 'Rejected one');
		await rejectComment(mod, rejected, 'Not on topic');
		await published('u1', 'Someone else');
		if (!pending.ok) throw new Error(pending.reason);

		const rows = await getUserComments('author');
		expect(rows.map((r) => [r.body, r.status]).sort()).toEqual([
			['Deleted one', 'deleted'],
			['Pending one', 'pending'],
			['Published one', 'published'],
			['Rejected one', 'rejected']
		]);
		expect(rows.find((r) => r.id === rejected)).toMatchObject({
			moderationReason: 'Not on topic',
			kind: 'movie',
			tmdbId: 348,
			title: 'Alien'
		});
		expect(rows.find((r) => r.id === ok)?.status).toBe('published');
		const times = rows.map((r) => r.createdAt.getTime());
		expect(times).toEqual([...times].sort((a, b) => b - a));
	});
});
