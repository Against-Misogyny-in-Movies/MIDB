import { describe, it, expect, beforeEach, vi } from 'vitest';
import { eq } from 'drizzle-orm';
import { db } from '#lib/server/db.ts';
import { users } from '#db/schema/auth.ts';
import { titles } from '#db/schema/titles.ts';
import { commentReports, comments, moderationActions } from '#db/schema/community.ts';
import { userValues } from '#db/test/users.ts';
import {
	createComment,
	editComment,
	softDeleteComment,
	type CommentRow
} from '#lib/server/data/comment-queries.ts';
import { statusMove, runMove } from '#lib/server/data/comment-status.ts';
import {
	approveComment,
	banAccount,
	dismissReports,
	hideComment,
	muteUser,
	rejectComment,
	restoreComment
} from '#lib/server/data/moderation-actions.ts';
import { listPendingQueue, listRecentActions } from '#lib/server/data/moderation-queue.ts';
import type * as DecideModule from '#lib/server/moderation/decide.ts';
import type { UserRow } from '#lib/server/data/user-queries.ts';
import type { TitleRow } from '#lib/server/data/title-queries.ts';

const race: { during: (() => Promise<unknown>) | null } = { during: null };

// `decideStatus` runs between an edit's read and its write; a test sets `race.during` to let
// another request land in that window.
vi.mock('#lib/server/moderation/decide.ts', async (importOriginal) => {
	const original = await importOriginal<typeof DecideModule>();
	return {
		...original,
		decideStatus: async (...args: Parameters<typeof original.decideStatus>) => {
			const during = race.during;
			race.during = null;
			await during?.();
			return original.decideStatus(...args);
		}
	};
});

let title: TitleRow;
let mod: UserRow;
let admin: UserRow;

beforeEach(async () => {
	race.during = null;
	for (const id of ['author', 'u1', 'u2', 'u3', 'u4'])
		await db.insert(users).values(userValues(id));
	await db.insert(users).values(userValues('mod', { role: 'moderator' }));
	await db.insert(users).values(userValues('admin', { role: 'administrator' }));
	[mod] = await db.select().from(users).where(eq(users.id, 'mod'));
	[admin] = await db.select().from(users).where(eq(users.id, 'admin'));
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

const logged = async () => (await db.select().from(moderationActions)).length;

describe('moderation actions', () => {
	it('writes a log row in the same batch as each comment action', async () => {
		const id = (await createComment({ title, userId: 'author', body: 'Waiting' })) as {
			comment: { id: string };
		};
		const cid = id.comment.id;
		expect((await listPendingQueue()).map((i) => i.comment.id)).toEqual([cid]);

		expect(await approveComment(mod, cid)).toMatchObject({ ok: true });
		expect(await hideComment(mod, cid, 'spoilers')).toMatchObject({ ok: true });
		expect(await restoreComment(mod, cid)).toMatchObject({ ok: true });
		expect(await rejectComment(mod, cid, 'abuse')).toMatchObject({ ok: true });

		const log = await listRecentActions();
		expect(log.map((a) => a.action).sort()).toEqual(['approve', 'hide', 'reject', 'restore']);
		expect(log.every((a) => a.commentBody === 'Waiting' && a.actor?.id === 'mod')).toBe(true);
		// The log says which comment each action concerned and where it stands now, so a hide or a
		// reject can be undone from it.
		expect(log.every((a) => a.commentId === cid && a.commentStatus === 'rejected')).toBe(true);
		expect(await row(cid)).toMatchObject({
			status: 'rejected',
			moderationSource: 'moderator',
			moderationReason: 'abuse'
		});
	});

	it('logs nothing and changes nothing for an action the status does not allow', async () => {
		const cid = await published('author', 'Root');
		expect(await approveComment(mod, cid)).toEqual({ ok: false, reason: 'invalid-state' });
		expect(await restoreComment(mod, cid)).toEqual({ ok: false, reason: 'invalid-state' });
		expect(await approveComment(mod, 'missing')).toEqual({ ok: false, reason: 'not-found' });
		expect(
			(await db.select().from(moderationActions)).filter((a) => a.targetCommentId === cid)
		).toHaveLength(1);
	});

	it('mutes and bans with a log row, and keeps the log when the target is gone', async () => {
		const actor = mod;
		const before = Date.now();
		expect(await muteUser(actor, 'u1', 168, 'cool off')).toMatchObject({ ok: true });
		const muted = (await db.select().from(users).where(eq(users.id, 'u1')))[0].mutedUntil;
		expect(muted?.getTime()).toBeGreaterThanOrEqual(before + 168 * 3_600_000);

		expect(await banAccount(actor, 'u2', 'abuse')).toMatchObject({ ok: true });
		expect((await db.select().from(users).where(eq(users.id, 'u2')))[0]).toMatchObject({
			banReason: 'abuse'
		});

		await db.delete(users).where(eq(users.id, 'u2'));
		const log = await db.select().from(moderationActions);
		expect(log.map((l) => l.action).sort()).toEqual(['ban', 'mute']);
		expect(log.find((l) => l.action === 'ban')?.targetUserId).toBeNull();
		expect(log.find((l) => l.action === 'mute')?.muteHours).toBe(168);
		expect(log.find((l) => l.action === 'ban')?.muteHours).toBeNull();
	});

	it('refuses a moderator on themselves, an administrator or a moderator, and an administrator on themselves', async () => {
		expect(await muteUser(mod, 'mod', 24, null)).toEqual({
			ok: false,
			reason: 'forbidden-target'
		});
		expect(await banAccount(mod, 'admin', null)).toEqual({ ok: false, reason: 'forbidden-target' });
		expect(await muteUser(admin, 'admin', 24, null)).toEqual({
			ok: false,
			reason: 'forbidden-target'
		});
		await db.insert(users).values(userValues('mod2', { role: 'moderator' }));
		expect(await muteUser(mod, 'mod2', 24, null)).toEqual({
			ok: false,
			reason: 'forbidden-target'
		});
		expect(await muteUser(admin, 'mod2', 24, null)).toMatchObject({ ok: true });
		expect(await banAccount(admin, 'admin', null)).toEqual({
			ok: false,
			reason: 'forbidden-target'
		});
		expect(await banAccount(mod, 'nobody', null)).toEqual({ ok: false, reason: 'not-found' });
	});
});

describe('a lost race', () => {
	const pendingId = async (): Promise<string> => {
		const result = await createComment({ title, userId: 'author', body: 'Waiting' });
		if (!result.ok) throw new Error(result.reason);
		return result.comment.id;
	};

	it('never reports both a delete and an approval as done', async () => {
		const id = await pendingId();
		const [deleted, approved] = await Promise.all([
			softDeleteComment(id, 'author'),
			approveComment(mod, id)
		]);
		expect([deleted.ok, approved.ok].filter(Boolean)).toHaveLength(1);
		if (deleted.ok) {
			expect(approved).toEqual({ ok: false, reason: 'invalid-state' });
			expect((await row(id)).status).toBe('deleted');
		} else {
			expect(deleted).toEqual({ ok: false, reason: 'conflict' });
			expect((await row(id)).status).toBe('published');
		}
		expect(await logged()).toBe(approved.ok ? 1 : 0);
	});

	it('answers conflict to an edit when the status moved under it', async () => {
		const id = await pendingId();
		race.during = () => approveComment(mod, id);
		const result = await editComment(id, 'author', 'Changed');
		expect(result).toEqual({ ok: false, reason: 'conflict' });
		expect(await row(id)).toMatchObject({ status: 'published', body: 'Waiting', editedAt: null });
	});

	it('lets one of two moderators win and logs one action', async () => {
		const id = await pendingId();
		const [approved, rejected] = await Promise.all([
			approveComment(mod, id),
			rejectComment(admin, id, 'no')
		]);
		expect([approved.ok, rejected.ok].filter(Boolean)).toHaveLength(1);
		expect([approved, rejected].find((r) => !r.ok)).toEqual({
			ok: false,
			reason: 'invalid-state'
		});
		expect(await logged()).toBe(1);
	});

	it('resolves no reports and logs nothing when the move is lost', async () => {
		const id = await published('author', 'Reported');
		await db.insert(commentReports).values({ commentId: id, reporterId: 'u1', reason: 'spam' });
		// A move that expects `pending` on a published comment changes nothing.
		expect(await runMove(statusMove(id, 'pending', 'rejected'))).toBe(false);
		const [report] = await db.select().from(commentReports);
		expect(report.status).toBe('open');
		expect((await row(id)).status).toBe('published');
	});
});

describe('moderator authority over a comment', () => {
	it('refuses a moderator on their own comment and on an administrator’s', async () => {
		for (const userId of ['mod', 'admin']) {
			const result = await createComment({ title, userId, body: `By ${userId}` });
			if (!result.ok) throw new Error(result.reason);
			const id = result.comment.id;
			const refused = { ok: false, reason: 'forbidden-target' };
			expect(await approveComment(mod, id)).toEqual(refused);
			expect(await hideComment(mod, id, null)).toEqual(refused);
			expect((await row(id)).status).toBe('pending');
		}
		expect(await logged()).toBe(0);
	});

	it('refuses to dismiss the reports on such a comment', async () => {
		const result = await createComment({ title, userId: 'admin', body: 'Reported' });
		if (!result.ok) throw new Error(result.reason);
		await db
			.insert(commentReports)
			.values({ commentId: result.comment.id, reporterId: 'u1', reason: 'spam' });
		expect(await dismissReports(mod, result.comment.id)).toEqual({
			ok: false,
			reason: 'forbidden-target'
		});
		const [report] = await db.select().from(commentReports);
		expect(report.status).toBe('open');
	});

	it('lets an administrator act on a moderator’s, an administrator’s and their own comment', async () => {
		await db.insert(users).values(userValues('admin2', { role: 'administrator' }));
		for (const userId of ['mod', 'admin2', 'admin']) {
			const result = await createComment({ title, userId, body: `By ${userId}` });
			if (!result.ok) throw new Error(result.reason);
			expect(await approveComment(admin, result.comment.id)).toMatchObject({ ok: true });
			expect(await hideComment(admin, result.comment.id, null)).toMatchObject({ ok: true });
		}
	});

	it('lets an administrator dismiss the reports on their own comment', async () => {
		const result = await createComment({ title, userId: 'admin', body: 'Reported' });
		if (!result.ok) throw new Error(result.reason);
		await db
			.insert(commentReports)
			.values({ commentId: result.comment.id, reporterId: 'u1', reason: 'spam' });
		expect(await dismissReports(admin, result.comment.id)).toMatchObject({ ok: true });
	});
});
