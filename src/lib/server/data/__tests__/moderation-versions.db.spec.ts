import { describe, it, expect, beforeEach, vi } from 'vitest';
import { eq } from 'drizzle-orm';
import { db } from '#lib/server/db.ts';
import { users } from '#db/schema/auth.ts';
import { titles } from '#db/schema/titles.ts';
import { commentReports, comments, moderationActions } from '#db/schema/community.ts';
import { userValues } from '#db/test/users.ts';
import { createComment, editComment, type CommentRow } from '#lib/server/data/comment-queries.ts';
import {
	approveComment,
	banAccount,
	dismissReports,
	hideComment,
	muteUser,
	rejectComment,
	restoreComment
} from '#lib/server/data/moderation-actions.ts';
import type * as ReplyAuthorsModule from '#lib/server/data/comment-reply-authors.ts';
import type { UserRow } from '#lib/server/data/user-queries.ts';
import type { TitleRow } from '#lib/server/data/title-queries.ts';

const race: {
	/** Runs between a moderator action's read and its batch. */
	beforeMove: (() => Promise<unknown>) | null;
} = { beforeMove: null };

// `replyAuthorsAffected` runs between an action's read and its batch; a test sets
// `race.beforeMove` to let another request land in that window.
vi.mock('#lib/server/data/comment-reply-authors.ts', async (importOriginal) => {
	const original = await importOriginal<typeof ReplyAuthorsModule>();
	return {
		...original,
		replyAuthorsAffected: async (...args: Parameters<typeof original.replyAuthorsAffected>) => {
			const found = await original.replyAuthorsAffected(...args);
			const beforeMove = race.beforeMove;
			race.beforeMove = null;
			await beforeMove?.();
			return found;
		}
	};
});

let title: TitleRow;
let mod: UserRow;
let admin: UserRow;

beforeEach(async () => {
	race.beforeMove = null;
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

const logged = async () => (await db.select().from(moderationActions)).length;

/** Stores a comment, then publishes it directly: the seam holds new comments for review. */
async function published(userId: string, body: string): Promise<string> {
	const result = await createComment({ title, userId, body });
	if (!result.ok) throw new Error(result.reason);
	await approveComment(mod, result.comment.id, null);
	return result.comment.id;
}

const pendingComment = async (userId = 'author'): Promise<string> => {
	const result = await createComment({ title, userId, body: 'Waiting' });
	if (!result.ok) throw new Error(result.reason);
	return result.comment.id;
};

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
		expect(await approveComment(mod, id, null)).toEqual({ ok: false, reason: 'edited' });
		expect(await approveComment(mod, id, at - 1)).toEqual({ ok: false, reason: 'edited' });
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
		expect(await approveComment(mod, id, null)).toEqual({ ok: false, reason: 'edited' });
		const after = await row(id);
		expect(after).toMatchObject({ status: 'pending', body: 'Swapped text' });
		expect(await logged()).toBe(0);
	});

	it('answers edited, not invalid-state, when the edit lands between the read and the batch', async () => {
		const id = await pendingComment();
		race.beforeMove = () => editComment(id, 'author', 'Swapped late');
		expect(await approveComment(mod, id, null)).toEqual({ ok: false, reason: 'edited' });
		expect(await row(id)).toMatchObject({ status: 'pending', body: 'Swapped late' });
		expect(await logged()).toBe(0);
	});

	it('answers invalid-state when a moderator acts between the read and the batch', async () => {
		const id = await pendingComment();
		race.beforeMove = () => rejectComment(mod, id, 'abuse');
		expect(await approveComment(mod, id, null)).toEqual({ ok: false, reason: 'invalid-state' });
	});

	it('dismisses reports with a late edit as edited too', async () => {
		const id = await published('author', 'Reported');
		await db.insert(commentReports).values({ commentId: id, reporterId: 'u1', reason: 'spam' });
		await db
			.update(comments)
			.set({ status: 'pending', moderationSource: 'reports' })
			.where(eq(comments.id, id));
		race.beforeMove = () => editComment(id, 'author', 'Swapped late');
		expect(await dismissReports(mod, id, null)).toEqual({ ok: false, reason: 'edited' });
		expect((await db.select().from(commentReports))[0].status).toBe('open');
	});

	it('restores a hidden comment only at the version it was seen at', async () => {
		const id = await published('author', 'Root');
		await hideComment(mod, id, null);
		await db
			.update(comments)
			.set({ editedAt: new Date(5000) })
			.where(eq(comments.id, id));
		expect(await restoreComment(mod, id, null)).toEqual({ ok: false, reason: 'edited' });
		expect(await restoreComment(mod, id, 4000)).toEqual({ ok: false, reason: 'edited' });
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
		expect(await dismissReports(mod, id, null)).toEqual({ ok: false, reason: 'edited' });
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
		const refused = { ok: false, reason: 'admin-acted' };
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
		const other = await pendingComment();
		await hideComment(mod, other, null);
		expect(await restoreComment(mod, other, null)).toMatchObject({ ok: true });
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

describe('an administrator’s decision binds a moderator on every action', () => {
	const refused = { ok: false, reason: 'admin-acted' };

	it('keeps a moderator from hiding or rejecting a comment an administrator last acted on', async () => {
		const approved = await pendingComment();
		expect(await approveComment(admin, approved, null)).toMatchObject({ ok: true });
		const before = await logged();
		expect(await hideComment(mod, approved, null)).toEqual(refused);
		expect(await rejectComment(mod, approved, 'abuse')).toEqual(refused);
		expect((await row(approved)).status).toBe('published');
		expect(await logged()).toBe(before);
		// The administrator still may, and a moderator may once a moderator acted last.
		expect(await hideComment(admin, approved, null)).toMatchObject({ ok: true });
		expect(await restoreComment(admin, approved, null)).toMatchObject({ ok: true });
		expect(await hideComment(admin, approved, null)).toMatchObject({ ok: true });
		expect(await restoreComment(admin, approved, null)).toMatchObject({ ok: true });
	});

	it('lets a moderator hide or reject once a moderator acted after the administrator', async () => {
		const id = await pendingComment();
		await approveComment(admin, id, null);
		await db.insert(moderationActions).values({
			actorId: 'mod',
			targetCommentId: id,
			action: 'dismiss',
			createdAt: new Date(Date.now() + 1000)
		});
		expect(await hideComment(mod, id, null)).toMatchObject({ ok: true });
		expect((await row(id)).status).toBe('hidden');
	});

	/** An administrator's log row landing between a moderator's read and the moderator's batch. */
	const adminActsInTheWindow = (commentId: string) => {
		race.beforeMove = async () => {
			await db.insert(moderationActions).values({
				actorId: 'admin',
				targetCommentId: commentId,
				action: 'dismiss'
			});
		};
	};

	it.each([
		['hide', (id: string) => hideComment(mod, id, null), 'published'],
		['reject', (id: string) => rejectComment(mod, id, 'abuse'), 'published'],
		['approve', (id: string) => approveComment(mod, id, null), 'pending'],
		['restore', (id: string) => restoreComment(mod, id, null), 'hidden']
	] as const)(
		'writes nothing when an administrator acts after a moderator’s %s was read',
		async (_name, act, status) => {
			const id = await pendingComment();
			if (status !== 'pending') {
				await db.update(comments).set({ status }).where(eq(comments.id, id));
			}
			await db.insert(commentReports).values({ commentId: id, reporterId: 'u1', reason: 'spam' });
			adminActsInTheWindow(id);
			const before = await logged();
			expect(await act(id)).toEqual(refused);
			expect((await row(id)).status).toBe(status);
			expect((await db.select().from(commentReports))[0].status).toBe('open');
			expect(await logged()).toBe(before + 1);
		}
	);

	it('writes nothing when an administrator acts after a moderator’s dismiss was read', async () => {
		const id = await pendingComment();
		await db.update(comments).set({ moderationSource: 'reports' }).where(eq(comments.id, id));
		await db.insert(commentReports).values({ commentId: id, reporterId: 'u1', reason: 'spam' });
		adminActsInTheWindow(id);
		expect(await dismissReports(mod, id, null)).toEqual(refused);
		expect((await row(id)).status).toBe('pending');
		expect((await db.select().from(commentReports))[0].status).toBe('open');
	});

	it('does not stop an administrator who acts in the same window', async () => {
		const id = await pendingComment();
		race.beforeMove = async () => {
			await db.insert(moderationActions).values({
				actorId: 'admin',
				targetCommentId: id,
				action: 'dismiss'
			});
		};
		expect(await hideComment(admin, id, null)).toMatchObject({ ok: true });
		expect((await row(id)).status).toBe('hidden');
	});
});

describe('a banned account is not banned or muted again', () => {
	const banned = { ok: false, reason: 'already-banned' };

	it('refuses a second ban and a mute, for a moderator and an administrator', async () => {
		expect(await banAccount(mod, 'u1', 'spam')).toMatchObject({ ok: true });
		const before = await logged();
		const [{ bannedAt, banReason }] = await db.select().from(users).where(eq(users.id, 'u1'));
		expect(await banAccount(mod, 'u1', 'again')).toEqual(banned);
		expect(await banAccount(admin, 'u1', 'again')).toEqual(banned);
		expect(await muteUser(mod, 'u1', 24, null)).toEqual(banned);
		expect(await muteUser(admin, 'u1', 24, null)).toEqual(banned);
		expect(await logged()).toBe(before);
		const [after] = await db.select().from(users).where(eq(users.id, 'u1'));
		expect([after.bannedAt, after.banReason, after.mutedUntil]).toEqual([
			bannedAt,
			banReason,
			null
		]);
	});

	it('still mutes and bans an account that is not banned, muted or not', async () => {
		expect(await muteUser(mod, 'u2', 24, null)).toMatchObject({ ok: true });
		expect(await banAccount(mod, 'u2', null)).toMatchObject({ ok: true });
	});

	it('answers forbidden-target before already-banned', async () => {
		await banAccount(admin, 'mod', 'x');
		expect(await banAccount(mod, 'mod', null)).toEqual({ ok: false, reason: 'forbidden-target' });
		expect(await banAccount(admin, 'mod', null)).toEqual(banned);
	});
});
