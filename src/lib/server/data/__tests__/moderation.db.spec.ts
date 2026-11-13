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

const race: {
	during: (() => Promise<unknown>) | null;
	/** A decision `decideStatus` answers instead of running the check. */
	forced: Awaited<ReturnType<typeof DecideModule.decideStatus>> | null;
} = { during: null, forced: null };

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
			return race.forced ?? original.decideStatus(...args);
		}
	};
});

let title: TitleRow;
let mod: UserRow;
let admin: UserRow;

beforeEach(async () => {
	race.during = null;
	race.forced = null;
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
	await approveComment(mod, id, null);
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

		expect(await approveComment(mod, cid, null)).toMatchObject({ ok: true });
		expect(await hideComment(mod, cid, 'spoilers')).toMatchObject({ ok: true });
		expect(await restoreComment(mod, cid, null)).toMatchObject({ ok: true });
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
		expect(await approveComment(mod, cid, null)).toEqual({ ok: false, reason: 'invalid-state' });
		expect(await restoreComment(mod, cid, null)).toEqual({ ok: false, reason: 'invalid-state' });
		expect(await approveComment(mod, 'missing', null)).toEqual({ ok: false, reason: 'not-found' });
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
			approveComment(mod, id, null)
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
		race.during = () => approveComment(mod, id, null);
		const result = await editComment(id, 'author', 'Changed');
		expect(result).toEqual({ ok: false, reason: 'conflict' });
		expect(await row(id)).toMatchObject({ status: 'published', body: 'Waiting', editedAt: null });
	});

	it('lets one of two moderators win and logs one action', async () => {
		const id = await pendingId();
		const [approved, rejected] = await Promise.all([
			approveComment(mod, id, null),
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
			expect(await approveComment(mod, id, null)).toEqual(refused);
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
		expect(await dismissReports(mod, result.comment.id, null)).toEqual({
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
			expect(await approveComment(admin, result.comment.id, null)).toMatchObject({ ok: true });
			expect(await hideComment(admin, result.comment.id, null)).toMatchObject({ ok: true });
		}
	});

	it('lets an administrator dismiss the reports on their own comment', async () => {
		const result = await createComment({ title, userId: 'admin', body: 'Reported' });
		if (!result.ok) throw new Error(result.reason);
		await db
			.insert(commentReports)
			.values({ commentId: result.comment.id, reporterId: 'u1', reason: 'spam' });
		expect(await dismissReports(admin, result.comment.id, null)).toMatchObject({ ok: true });
	});
});

const pendingComment = async (userId = 'author'): Promise<string> => {
	const result = await createComment({ title, userId, body: 'Waiting' });
	if (!result.ok) throw new Error(result.reason);
	return result.comment.id;
};

describe('an edit after a decision', () => {
	const clean = { status: 'published', source: 'ai', reason: null, aiVerdict: null } as const;

	it('cannot revive a comment a moderator rejected, but can fix one the check rejected', async () => {
		const id = await pendingComment();
		await rejectComment(mod, id, 'abuse');
		expect(await editComment(id, 'author', 'Fixed')).toEqual({ ok: false, reason: 'not-editable' });
		expect(await row(id)).toMatchObject({ status: 'rejected', body: 'Waiting' });

		for (const source of ['ai', 'blocklist'] as const) {
			const other = await pendingComment();
			await db
				.update(comments)
				.set({ status: 'rejected', moderationSource: source, moderationReason: 'No.' })
				.where(eq(comments.id, other));
			race.forced = clean;
			const edit = await editComment(other, 'author', 'Fixed');
			race.forced = null;
			expect(edit).toMatchObject({ ok: true });
			expect(await row(other)).toMatchObject({ status: 'published', body: 'Fixed' });
		}
	});

	it('keeps a pending comment that a moderator or the reports held from publishing itself', async () => {
		for (const source of ['moderator', 'reports'] as const) {
			const id = await pendingComment();
			await db
				.update(comments)
				.set({ moderationSource: source, moderationReason: 'Held.' })
				.where(eq(comments.id, id));
			race.forced = clean;
			const edit = await editComment(id, 'author', `Edited ${source}`);
			race.forced = null;
			expect(edit).toMatchObject({ ok: true });
			expect(await row(id)).toMatchObject({
				status: 'pending',
				moderationSource: source,
				moderationReason: 'Held.',
				body: `Edited ${source}`
			});
		}
	});

	it('still rejects a held pending comment when the check rejects the edit', async () => {
		const id = await pendingComment();
		await db.update(comments).set({ moderationSource: 'moderator' }).where(eq(comments.id, id));
		race.forced = { status: 'rejected', source: 'ai', reason: 'Slur.', aiVerdict: null };
		expect(await editComment(id, 'author', 'Worse')).toMatchObject({ ok: true });
		expect(await row(id)).toMatchObject({ status: 'rejected', moderationSource: 'ai' });
	});

	it('still publishes an edit of a pending comment held by the check', async () => {
		const id = await pendingComment();
		await db.update(comments).set({ moderationSource: 'ai' }).where(eq(comments.id, id));
		race.forced = clean;
		await editComment(id, 'author', 'Cleaner');
		expect((await row(id)).status).toBe('published');
	});

	it('answers not-found to anyone but the author, whatever the status', async () => {
		const id = await pendingComment();
		for (const status of ['pending', 'published', 'hidden', 'rejected', 'deleted'] as const) {
			await db.update(comments).set({ status }).where(eq(comments.id, id));
			expect(await editComment(id, 'u1', 'Mine')).toEqual({ ok: false, reason: 'not-found' });
			expect(await softDeleteComment(id, 'u1')).toEqual({ ok: false, reason: 'not-found' });
		}
	});
});

describe('a moderator publishes only the text they saw', () => {
	/** A pending comment edited once, so its `editedAt` is set; returns the id and the stored time. */
	async function edited(): Promise<{ id: string; at: number }> {
		const id = await pendingComment();
		await editComment(id, 'author', 'Edited once');
		const at = (await row(id)).editedAt?.getTime();
		if (at === undefined) throw new Error('not edited');
		return { id, at };
	}

	it('approves with the editedAt the view loaded and refuses a stale or missing one', async () => {
		const { id, at } = await edited();
		expect(await approveComment(mod, id, null)).toEqual({ ok: false, reason: 'invalid-state' });
		expect(await approveComment(mod, id, at - 1)).toEqual({ ok: false, reason: 'invalid-state' });
		expect(await logged()).toBe(0);
		expect((await row(id)).status).toBe('pending');
		expect(await approveComment(mod, id, at)).toMatchObject({ ok: true });
		expect(await logged()).toBe(1);
	});

	it('refuses an approval when the author edits between the read and the batch', async () => {
		const id = await pendingComment();
		const stale = await row(id);
		await editComment(id, 'author', 'Swapped text');
		expect(stale.editedAt).toBeNull();
		expect(await approveComment(mod, id, null)).toEqual({ ok: false, reason: 'invalid-state' });
		const after = await row(id);
		expect(after).toMatchObject({ status: 'pending', body: 'Swapped text' });
		expect(await logged()).toBe(0);
	});

	it('restores a hidden comment only at the version it was seen at', async () => {
		const id = await published('author', 'Root');
		await hideComment(mod, id, null);
		await db
			.update(comments)
			.set({ editedAt: new Date(5000) })
			.where(eq(comments.id, id));
		expect(await restoreComment(mod, id, null)).toEqual({ ok: false, reason: 'invalid-state' });
		expect(await restoreComment(mod, id, 4000)).toEqual({ ok: false, reason: 'invalid-state' });
		expect((await row(id)).status).toBe('hidden');
		expect(await restoreComment(mod, id, 5000)).toMatchObject({ ok: true });
		expect((await row(id)).status).toBe('published');
	});

	it('dismisses reports that sent a comment to review only at the version seen', async () => {
		const id = await published('author', 'Reported');
		await db.insert(commentReports).values({ commentId: id, reporterId: 'u1', reason: 'spam' });
		await db
			.update(comments)
			.set({ status: 'pending', moderationSource: 'reports', editedAt: new Date(7000) })
			.where(eq(comments.id, id));
		const before = await logged();
		expect(await dismissReports(mod, id, null)).toEqual({ ok: false, reason: 'invalid-state' });
		expect(await logged()).toBe(before);
		expect((await db.select().from(commentReports))[0].status).toBe('open');
		expect((await row(id)).status).toBe('pending');
		expect(await dismissReports(mod, id, 7000)).toMatchObject({ ok: true });
		expect((await row(id)).status).toBe('published');
		expect((await db.select().from(commentReports))[0].status).toBe('dismissed');
	});

	it('needs no version to hide or reject', async () => {
		const id = await pendingComment();
		await editComment(id, 'author', 'Edited');
		expect(await hideComment(mod, id, null)).toMatchObject({ ok: true });
	});
});

describe('an administrator’s decision binds a moderator', () => {
	it('keeps a moderator from approving, restoring or dismissing after an administrator acted', async () => {
		const id = await pendingComment();
		await rejectComment(admin, id, 'abuse');
		const refused = { ok: false, reason: 'forbidden-target' };
		expect(await restoreComment(mod, id, null)).toEqual(refused);
		expect((await row(id)).status).toBe('rejected');

		await db.insert(commentReports).values({ commentId: id, reporterId: 'u1', reason: 'spam' });
		expect(await dismissReports(mod, id, null)).toEqual(refused);
		expect((await db.select().from(commentReports))[0].status).toBe('open');

		const hiddenByAdmin = await pendingComment();
		await hideComment(admin, hiddenByAdmin, null);
		await db.update(comments).set({ status: 'pending' }).where(eq(comments.id, hiddenByAdmin));
		expect(await approveComment(mod, hiddenByAdmin, null)).toEqual(refused);
	});

	it('lets an administrator undo their own action, and a moderator act once a moderator was last', async () => {
		const id = await pendingComment();
		await rejectComment(admin, id, 'abuse');
		expect(await restoreComment(admin, id, null)).toMatchObject({ ok: true });
		await hideComment(mod, id, null);
		expect(await restoreComment(mod, id, null)).toMatchObject({ ok: true });
	});

	it('does not let a moderator shorten an active mute, and lets an administrator set any length', async () => {
		const mutedUntil = async () =>
			(await db.select().from(users).where(eq(users.id, 'u3')))[0].mutedUntil?.getTime() ?? 0;
		await muteUser(admin, 'u3', 168, null);
		const long = await mutedUntil();
		expect(await muteUser(mod, 'u3', 24, null)).toMatchObject({ ok: true });
		expect(await mutedUntil()).toBe(long);
		await muteUser(admin, 'u3', 24, null);
		expect(await mutedUntil()).toBeLessThan(long);
		const short = await mutedUntil();
		await muteUser(mod, 'u3', 168, null);
		expect(await mutedUntil()).toBeGreaterThan(short);
		expect(
			(await db.select().from(moderationActions)).filter((a) => a.action === 'mute')
		).toHaveLength(4);
	});

	it('mutes an account that has no mute yet for the moderator’s length', async () => {
		const before = Date.now();
		await muteUser(mod, 'u4', 24, null);
		const until = (await db.select().from(users).where(eq(users.id, 'u4')))[0].mutedUntil;
		expect(until?.getTime()).toBeGreaterThanOrEqual(before + 24 * 3_600_000);
	});
});
