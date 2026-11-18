import { beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { db } from '#lib/server/db.ts';
import { users } from '#db/schema/auth.ts';
import { moderationActions } from '#db/schema/community.ts';
import { userValues } from '#db/test/users.ts';
import { listRecentActions } from '../recent-actions.ts';
import { listStaff, setStaffRole } from '../staff-roles.ts';
import { scrubAccount } from '../account-scrub.ts';
import { getUserById, type UserRow } from '../user-queries.ts';

let admin: UserRow;
let moderator: UserRow;

beforeEach(async () => {
	await db.insert(users).values([
		userValues('admin', {
			role: 'administrator',
			username: 'ada_admin',
			createdAt: new Date(1_000)
		}),
		userValues('admin2', {
			role: 'administrator',
			username: 'zed_admin',
			createdAt: new Date(2_000)
		}),
		userValues('mod', { role: 'moderator', username: 'mod_one', createdAt: new Date(3_000) }),
		userValues('user', { username: 'Plain_User' }),
		userValues('banned', { username: 'banned_one', bannedAt: new Date(), banReason: 'x' })
	]);
	admin = (await getUserById('admin'))!;
	moderator = (await getUserById('mod'))!;
});

const role = async (id: string) => (await getUserById(id))!.role;
const log = () =>
	db.select().from(moderationActions).where(eq(moderationActions.action, 'set_role'));

describe('setStaffRole: making a moderator', () => {
	it('gives the role by username in any case, logs the new role and names the profile to purge', async () => {
		expect(await setStaffRole(admin, { username: 'PLAIN_user' }, 'moderator')).toEqual({
			ok: true,
			title: null,
			purge: { profiles: ['user'], commentTitles: [] }
		});
		expect(await role('user')).toBe('moderator');
		const [row] = await log();
		expect(row).toMatchObject({
			actorId: 'admin',
			targetUserId: 'user',
			action: 'set_role',
			reason: 'moderator',
			rule: null,
			targetCommentId: null
		});
	});

	it('shows in the log as its own action with the new role', async () => {
		await setStaffRole(admin, { username: 'plain_user' }, 'moderator');
		const { items } = await listRecentActions(null, undefined, { accountId: 'user' });
		expect(items).toHaveLength(1);
		expect(items[0]).toMatchObject({ action: 'set_role', reason: 'moderator' });
	});

	it('refuses an unknown username, and a deleted account, which has none', async () => {
		expect(await setStaffRole(admin, { username: 'nobody_1' }, 'moderator')).toEqual({
			ok: false,
			reason: 'unknown-account'
		});
		await scrubAccount('user');
		expect(await setStaffRole(admin, { username: 'plain_user' }, 'moderator')).toEqual({
			ok: false,
			reason: 'unknown-account'
		});
		expect(await log()).toHaveLength(0);
	});

	it('refuses a banned account, an account that is already a moderator, and an administrator', async () => {
		expect(await setStaffRole(admin, { username: 'banned_one' }, 'moderator')).toEqual({
			ok: false,
			reason: 'account-banned'
		});
		expect(await setStaffRole(admin, { username: 'mod_one' }, 'moderator')).toEqual({
			ok: false,
			reason: 'already-role'
		});
		expect(await setStaffRole(admin, { username: 'zed_admin' }, 'moderator')).toEqual({
			ok: false,
			reason: 'is-administrator'
		});
		expect(await role('banned')).toBe('user');
		expect(await role('admin2')).toBe('administrator');
		expect(await log()).toHaveLength(0);
	});

	it('is for administrators only: a moderator or an ordinary account changes nothing', async () => {
		for (const actor of [moderator, (await getUserById('user'))!]) {
			expect(await setStaffRole(actor, { username: 'plain_user' }, 'moderator')).toEqual({
				ok: false,
				reason: 'not-administrator'
			});
		}
		expect(await role('user')).toBe('user');
		expect(await log()).toHaveLength(0);
	});
});

describe('setStaffRole: removing the role', () => {
	it('returns a moderator to user by id and logs it', async () => {
		expect(await setStaffRole(admin, { id: 'mod' }, 'user')).toEqual({
			ok: true,
			title: null,
			purge: { profiles: ['mod'], commentTitles: [] }
		});
		expect(await role('mod')).toBe('user');
		expect((await log())[0]).toMatchObject({ targetUserId: 'mod', reason: 'user' });
	});

	it('refuses an account without the role, and an unknown or deleted id', async () => {
		expect(await setStaffRole(admin, { id: 'user' }, 'user')).toEqual({
			ok: false,
			reason: 'already-role'
		});
		expect(await setStaffRole(admin, { id: 'nobody' }, 'user')).toEqual({
			ok: false,
			reason: 'not-found'
		});
		await scrubAccount('mod');
		expect(await setStaffRole(admin, { id: 'mod' }, 'user')).toEqual({
			ok: false,
			reason: 'not-found'
		});
		expect(await log()).toHaveLength(0);
	});

	it('never demotes an administrator, and says so when it is the last one', async () => {
		expect(await setStaffRole(admin, { id: 'admin2' }, 'user')).toEqual({
			ok: false,
			reason: 'is-administrator'
		});
		expect(await setStaffRole(admin, { id: 'admin' }, 'user')).toEqual({
			ok: false,
			reason: 'is-administrator'
		});
		await db.update(users).set({ bannedAt: new Date() }).where(eq(users.id, 'admin2'));
		expect(await setStaffRole(admin, { id: 'admin' }, 'user')).toEqual({
			ok: false,
			reason: 'last-administrator'
		});
		expect(await role('admin')).toBe('administrator');
		expect(await log()).toHaveLength(0);
	});

	it('can demote a banned moderator', async () => {
		await db.update(users).set({ bannedAt: new Date() }).where(eq(users.id, 'mod'));
		expect(await setStaffRole(admin, { id: 'mod' }, 'user')).toMatchObject({ ok: true });
	});
});

describe('listStaff', () => {
	it('lists administrators then moderators by username, and no ordinary, banned-user or deleted account', async () => {
		const staff = await listStaff();
		expect(staff.map((s) => [s.user.username, s.user.role])).toEqual([
			['ada_admin', 'administrator'],
			['zed_admin', 'administrator'],
			['mod_one', 'moderator']
		]);
		expect(JSON.stringify(staff)).not.toContain('@example.com');
	});

	it('dates a moderator from the latest time the role was given, else from the day they joined', async () => {
		expect((await listStaff()).find((s) => s.user.id === 'mod')?.since).toBe(
			new Date(3_000).toISOString()
		);
		await db.insert(moderationActions).values([
			{
				id: 's1',
				actorId: 'admin',
				targetUserId: 'mod',
				action: 'set_role',
				reason: 'moderator',
				createdAt: new Date(10_000)
			},
			{
				id: 's2',
				actorId: 'admin',
				targetUserId: 'mod',
				action: 'set_role',
				reason: 'user',
				createdAt: new Date(20_000)
			},
			{
				id: 's3',
				actorId: 'admin',
				targetUserId: 'mod',
				action: 'set_role',
				reason: 'moderator',
				createdAt: new Date(30_000)
			}
		]);
		expect((await listStaff()).find((s) => s.user.id === 'mod')?.since).toBe(
			new Date(30_000).toISOString()
		);
	});

	it('dates an administrator from the day they joined', async () => {
		expect((await listStaff())[0].since).toBe(new Date(1_000).toISOString());
	});

	it('shows a promotion at once and a demotion drops the row', async () => {
		await setStaffRole(admin, { username: 'plain_user' }, 'moderator');
		expect((await listStaff()).map((s) => s.user.username)).toContain('Plain_User');
		await setStaffRole(admin, { id: 'user' }, 'user');
		expect((await listStaff()).map((s) => s.user.username)).not.toContain('Plain_User');
	});
});
