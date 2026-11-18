import { beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { db } from '#lib/server/db.ts';
import { users } from '#db/schema/auth.ts';
import { titles } from '#db/schema/titles.ts';
import {
	commentVotes,
	comments,
	moderationActions,
	titleCountFlags
} from '#db/schema/community.ts';
import { userValues } from '#db/test/users.ts';
import { banAccount, muteUser } from '../moderation-actions.ts';
import { unbanAccount, unmuteUser } from '../moderation-reversals.ts';
import { listPendingQueue } from '../moderation-queue.ts';
import { listRecentActions } from '../recent-actions.ts';
import { getOpenTitle } from '../community-report-queue.ts';
import { getUserById, type UserRow } from '../user-queries.ts';

let mod: UserRow;
let mod2: UserRow;
let admin: UserRow;
let titleId: string;

beforeEach(async () => {
	await db
		.insert(users)
		.values([
			userValues('mod', { role: 'moderator' }),
			userValues('mod2', { role: 'moderator' }),
			userValues('admin', { role: 'administrator' }),
			userValues('admin2', { role: 'administrator' }),
			userValues('u1'),
			userValues('u2')
		]);
	mod = (await getUserById('mod'))!;
	mod2 = (await getUserById('mod2'))!;
	admin = (await getUserById('admin'))!;
	[{ id: titleId }] = await db
		.insert(titles)
		.values({ kind: 'movie', title: 'Alien', cleanTitle: 'alien', tmdbId: 348 })
		.returning();
});

const log = async (action: string) =>
	await db
		.select()
		.from(moderationActions)
		.where(eq(moderationActions.action, action as 'mute'));
const user = async (id: string) => (await getUserById(id))!;

describe('unmuteUser', () => {
	it('ends a mute, clears muted_until, logs it with the reason and names the profile and counts', async () => {
		await muteUser(mod, 'u1', 24, 'rude');
		const result = await unmuteUser(mod, 'u1', 'apologised');
		expect(result).toEqual({
			ok: true,
			title: null,
			purge: { profiles: ['u1'], reportedBy: 'u1' }
		});
		expect((await user('u1')).mutedUntil).toBeNull();
		const [row] = await log('unmute');
		expect(row).toMatchObject({ actorId: 'mod', targetUserId: 'u1', reason: 'apologised' });
	});

	it('lets an administrator end any mute and a moderator only a moderator’s', async () => {
		await muteUser(admin, 'u1', 24, null);
		await muteUser(mod2, 'u2', 24, null);
		expect(await unmuteUser(mod, 'u1', null)).toEqual({ ok: false, reason: 'admin-acted' });
		expect((await user('u1')).mutedUntil).not.toBeNull();
		expect(await log('unmute')).toHaveLength(0);
		expect(await unmuteUser(mod, 'u2', null)).toMatchObject({ ok: true });
		expect(await unmuteUser(admin, 'u1', null)).toMatchObject({ ok: true });
		expect(await log('unmute')).toHaveLength(2);
	});

	it('treats the latest mute row as the mute in force', async () => {
		await muteUser(mod, 'u1', 24, null);
		await new Promise((r) => setTimeout(r, 5));
		await muteUser(admin, 'u1', 168, null);
		expect(await unmuteUser(mod, 'u1', null)).toEqual({ ok: false, reason: 'admin-acted' });
	});

	it('refuses a moderator on staff and anyone on themselves, and answers not-found and not-muted', async () => {
		await muteUser(admin, 'mod2', 24, null);
		expect(await unmuteUser(mod, 'mod2', null)).toEqual({ ok: false, reason: 'forbidden-target' });
		expect(await unmuteUser(admin, 'admin', null)).toEqual({
			ok: false,
			reason: 'forbidden-target'
		});
		expect(await unmuteUser(mod, 'nobody', null)).toEqual({ ok: false, reason: 'not-found' });
		expect(await unmuteUser(mod, 'u1', null)).toEqual({ ok: false, reason: 'not-muted' });
		expect(await log('unmute')).toHaveLength(0);
	});

	it('ends a mute once: a second call logs nothing', async () => {
		await muteUser(mod, 'u1', 24, null);
		expect(await unmuteUser(mod, 'u1', null)).toMatchObject({ ok: true });
		expect(await unmuteUser(mod, 'u1', null)).toEqual({ ok: false, reason: 'not-muted' });
		expect(await log('unmute')).toHaveLength(1);
	});
});

describe('unbanAccount', () => {
	it('lifts a ban, clears the reason, logs it, and restores sign-in only', async () => {
		const [c] = await db
			.insert(comments)
			.values({ titleId, userId: 'u1', body: 'hello', status: 'published' })
			.returning();
		const [other] = await db
			.insert(comments)
			.values({ titleId, userId: 'u2', body: 'other', status: 'published' })
			.returning();
		await db.insert(commentVotes).values({ commentId: other.id, userId: 'u1', value: 1 });
		await banAccount(admin, 'u1', 'abuse');
		expect((await user('u1')).bannedAt).not.toBeNull();
		const result = await unbanAccount(admin, 'u1', 'mistake');
		expect(result).toEqual({
			ok: true,
			title: null,
			purge: { profiles: ['u1'], reportedBy: 'u1' }
		});
		const lifted = await user('u1');
		expect(lifted.bannedAt).toBeNull();
		expect(lifted.banReason).toBeNull();
		const [row] = await log('unban');
		expect(row).toMatchObject({ actorId: 'admin', targetUserId: 'u1', reason: 'mistake' });
		// The ban's effects stay: the comment is still hidden and the vote is still gone.
		const [after] = await db.select().from(comments).where(eq(comments.id, c.id));
		expect(after.status).toBe('hidden');
		expect(await db.select().from(commentVotes)).toHaveLength(0);
	});

	it('is for administrators only', async () => {
		await banAccount(admin, 'u1', null);
		expect(await unbanAccount(mod, 'u1', null)).toEqual({ ok: false, reason: 'admin-only' });
		expect((await user('u1')).bannedAt).not.toBeNull();
		expect(await log('unban')).toHaveLength(0);
	});

	it('answers not-found, not-banned and forbidden-target for the administrator’s own account', async () => {
		expect(await unbanAccount(admin, 'nobody', null)).toEqual({ ok: false, reason: 'not-found' });
		expect(await unbanAccount(admin, 'u1', null)).toEqual({ ok: false, reason: 'not-banned' });
		expect(await unbanAccount(admin, 'admin', null)).toEqual({
			ok: false,
			reason: 'forbidden-target'
		});
	});

	it('lifts a ban once: a second call logs nothing', async () => {
		await banAccount(admin, 'u1', null);
		expect(await unbanAccount(admin, 'u1', null)).toMatchObject({ ok: true });
		expect(await unbanAccount(admin, 'u1', null)).toEqual({ ok: false, reason: 'not-banned' });
		expect(await log('unban')).toHaveLength(1);
	});

	it('lets the account be muted or banned again', async () => {
		await banAccount(admin, 'u1', null);
		await unbanAccount(admin, 'u1', null);
		expect(await muteUser(mod, 'u1', 24, null)).toMatchObject({ ok: true });
		expect(await banAccount(admin, 'u1', null)).toMatchObject({ ok: true });
	});
});

describe('the log rows of a mute and a ban', () => {
	it('mark the one still in force, with whether a moderator set the mute', async () => {
		await muteUser(mod, 'u1', 24, null);
		await new Promise((r) => setTimeout(r, 5));
		await muteUser(admin, 'u2', 24, null);
		await banAccount(admin, 'u1', null);
		const { items } = await listRecentActions();
		const find = (action: string, target: string) =>
			items.find((i) => i.action === action && i.targetUser?.id === target)!;
		expect(find('mute', 'u1').inForce).toEqual({ byModerator: true });
		expect(find('mute', 'u2').inForce).toEqual({ byModerator: false });
		expect(find('ban', 'u1').inForce).toEqual({ byModerator: false });
		await unmuteUser(admin, 'u2', null);
		await unbanAccount(admin, 'u1', null);
		const after = (await listRecentActions()).items;
		expect(after.find((i) => i.action === 'mute' && i.targetUser?.id === 'u2')?.inForce).toBeNull();
		expect(after.find((i) => i.action === 'ban')?.inForce).toBeNull();
		expect(after.find((i) => i.action === 'unmute')?.inForce).toBeNull();
	});
});

describe('what the lists carry for the reversals', () => {
	it('a queue item says whether its author is banned and whether a moderator set the mute', async () => {
		await db.insert(comments).values([
			{ id: 'c1', titleId, userId: 'u1', body: 'one', status: 'pending' },
			{ id: 'c2', titleId, userId: 'u2', body: 'two', status: 'pending' }
		]);
		await muteUser(mod, 'u1', 24, null);
		await db.update(users).set({ bannedAt: new Date() }).where(eq(users.id, 'u2'));
		const { items } = await listPendingQueue();
		const by = (id: string) => items.find((i) => i.comment.id === id)!;
		expect(by('c1')).toMatchObject({ authorBanned: false, authorMutedByModerator: true });
		expect(by('c2')).toMatchObject({ authorBanned: true, authorMutedByModerator: false });
	});

	it('an open title lists its closed flags, which the flagged list does not', async () => {
		const flags = await db
			.insert(titleCountFlags)
			.values([
				{ titleId, reporterId: 'u1', status: 'resolved' },
				{ titleId, reporterId: 'u2', status: 'open' }
			])
			.returning();
		const open = await getOpenTitle(titleId);
		expect(open?.flags.map((f) => f.id)).toEqual([flags[1].id]);
		expect(open?.closedFlags.map((f) => [f.id, f.status])).toEqual([[flags[0].id, 'resolved']]);
	});
});
