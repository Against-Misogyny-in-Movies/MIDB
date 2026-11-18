import { beforeEach, describe, expect, it, vi } from 'vitest';
import { eq } from 'drizzle-orm';
import { db } from '#lib/server/db.ts';
import { sessions, users } from '#db/schema/auth.ts';
import { titles } from '#db/schema/titles.ts';
import { commentVotes, comments, moderationActions } from '#db/schema/community.ts';
import { userValues } from '#db/test/users.ts';
import type * as CommentStatusModule from '../comment-status.ts';
import { banAccount, muteUser } from '../moderation-actions.ts';
import { unmuteUser } from '../moderation-reversals.ts';
import { setStaffRole } from '../staff-roles.ts';
import { getUserById, type UserRow } from '../user-queries.ts';

const race: { beforeBatch: (() => Promise<unknown>) | null } = { beforeBatch: null };

// Every logged write runs its batch through `runBatch`; a test sets `race.beforeBatch` to let
// another request land between the write's read and its batch.
vi.mock('../comment-status.ts', async (importOriginal) => {
	const original = await importOriginal<typeof CommentStatusModule>();
	return {
		...original,
		runBatch: async (...args: Parameters<typeof original.runBatch>) => {
			const before = race.beforeBatch;
			race.beforeBatch = null;
			await before?.();
			return original.runBatch(...args);
		}
	};
});

let mod: UserRow;
let admin: UserRow;
let titleId: string;

beforeEach(async () => {
	race.beforeBatch = null;
	await db
		.insert(users)
		.values([
			userValues('mod', { role: 'moderator' }),
			userValues('admin', { role: 'administrator' }),
			userValues('admin2', { role: 'administrator' }),
			userValues('u1'),
			userValues('u2')
		]);
	mod = (await getUserById('mod'))!;
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

describe('a moderator and an administrator’s mute', () => {
	it('refuses a moderator’s mute while an administrator’s is in force, and the unmute that would follow', async () => {
		await muteUser(admin, 'u1', 168, 'spam');
		const mutedUntil = (await user('u1')).mutedUntil;
		expect(await muteUser(mod, 'u1', 24, null)).toEqual({ ok: false, reason: 'admin-acted' });
		expect(await unmuteUser(mod, 'u1', null)).toEqual({ ok: false, reason: 'admin-acted' });
		expect((await user('u1')).mutedUntil).toEqual(mutedUntil);
		expect(await log('mute')).toHaveLength(1);
		expect(await log('unmute')).toHaveLength(0);
	});

	it('refuses it when the administrator mutes after the moderator’s read', async () => {
		race.beforeBatch = async () => {
			await muteUser(admin, 'u1', 168, 'spam');
		};
		expect(await muteUser(mod, 'u1', 24, null)).toEqual({ ok: false, reason: 'admin-acted' });
		expect(await log('mute')).toHaveLength(1);
		expect((await log('mute'))[0].actorId).toBe('admin');
		expect(await unmuteUser(mod, 'u1', null)).toEqual({ ok: false, reason: 'admin-acted' });
	});

	it('lets a moderator mute again once the administrator’s mute has ended, and an administrator over a moderator’s', async () => {
		await db
			.insert(moderationActions)
			.values({ actorId: 'admin', targetUserId: 'u1', action: 'mute' });
		await db
			.update(users)
			.set({ mutedUntil: new Date(Date.now() - 1000) })
			.where(eq(users.id, 'u1'));
		expect(await muteUser(mod, 'u1', 24, null)).toMatchObject({ ok: true });
		expect(await muteUser(admin, 'u1', 1, null)).toMatchObject({ ok: true });
	});
});

describe('a mute or a ban racing a change of the target', () => {
	it('refuses a mute of an account promoted after the read', async () => {
		race.beforeBatch = async () => {
			await db.update(users).set({ role: 'moderator' }).where(eq(users.id, 'u1'));
		};
		expect(await muteUser(mod, 'u1', 24, null)).toEqual({
			ok: false,
			reason: 'forbidden-target'
		});
		expect((await user('u1')).mutedUntil).toBeNull();
		expect(await log('mute')).toHaveLength(0);
	});

	it('refuses a ban of an account promoted after the read, changing nothing', async () => {
		await db.insert(sessions).values({
			id: 's1',
			userId: 'u1',
			token: 't1',
			expiresAt: new Date(Date.now() + 1e6)
		});
		await db
			.insert(comments)
			.values({ id: 'c1', titleId, userId: 'u1', body: 'x', status: 'published' });
		race.beforeBatch = async () => {
			await db.update(users).set({ role: 'moderator' }).where(eq(users.id, 'u1'));
		};
		expect(await banAccount(mod, 'u1', 'spam')).toEqual({
			ok: false,
			reason: 'forbidden-target'
		});
		expect((await user('u1')).bannedAt).toBeNull();
		expect(await db.select().from(sessions)).toHaveLength(1);
		expect((await db.select().from(comments))[0].status).toBe('published');
		expect(await log('ban')).toHaveLength(0);
	});

	it('bans once when two bans race: one log row, the weight taken once', async () => {
		await db.insert(users).values(userValues('author'));
		const [parent] = await db
			.insert(comments)
			.values({ titleId, userId: 'author', body: 'p', replyCount: 2 })
			.returning();
		await db.insert(comments).values([
			{
				titleId,
				userId: 'u1',
				body: 'r1',
				parentId: parent.id,
				rootId: parent.id,
				status: 'published' as const
			},
			{
				titleId,
				userId: 'u2',
				body: 'r2',
				parentId: parent.id,
				rootId: parent.id,
				status: 'published' as const
			}
		]);
		await db.insert(commentVotes).values({ commentId: parent.id, userId: 'u1', value: 1 });
		await db.update(comments).set({ score: 1 }).where(eq(comments.id, parent.id));
		race.beforeBatch = async () => {
			expect(await banAccount(admin, 'u1', 'first')).toMatchObject({ ok: true });
		};
		expect(await banAccount(mod, 'u1', 'second')).toEqual({
			ok: false,
			reason: 'already-banned'
		});
		expect(await log('ban')).toHaveLength(1);
		expect((await user('u1')).banReason).toBe('first');
		const [after] = await db.select().from(comments).where(eq(comments.id, parent.id));
		expect(after).toMatchObject({ replyCount: 1, score: 0 });
	});
});

describe('the refusal an unmute that lost its batch answers', () => {
	it('says not-muted when the mute ended in the window', async () => {
		await muteUser(mod, 'u1', 24, null);
		race.beforeBatch = async () => {
			await unmuteUser(admin, 'u1', null);
		};
		expect(await unmuteUser(mod, 'u1', null)).toEqual({ ok: false, reason: 'not-muted' });
		expect(await log('unmute')).toHaveLength(1);
	});

	it('says admin-acted only when an administrator’s mute is now in force', async () => {
		await muteUser(mod, 'u1', 24, null);
		race.beforeBatch = async () => {
			await muteUser(admin, 'u1', 168, null);
		};
		expect(await unmuteUser(mod, 'u1', null)).toEqual({ ok: false, reason: 'admin-acted' });
		expect((await user('u1')).mutedUntil).not.toBeNull();
	});
});

describe('setStaffRole when the actor loses the role in the window', () => {
	it('answers not-administrator, not already-role', async () => {
		race.beforeBatch = async () => {
			await db.update(users).set({ role: 'user' }).where(eq(users.id, 'admin'));
		};
		expect(await setStaffRole(admin, { id: 'u1' }, 'moderator')).toEqual({
			ok: false,
			reason: 'not-administrator'
		});
		expect((await user('u1')).role).toBe('user');
		expect(await log('set_role')).toHaveLength(0);
	});

	it('names the comment lists of the titles the account has published comments on', async () => {
		await db.insert(comments).values({ titleId, userId: 'u1', body: 'x', status: 'published' });
		const result = await setStaffRole(admin, { id: 'u1' }, 'moderator');
		expect(result).toMatchObject({
			ok: true,
			purge: { profiles: ['u1'], commentTitles: [{ kind: 'movie', tmdbId: 348 }] }
		});
	});
});
