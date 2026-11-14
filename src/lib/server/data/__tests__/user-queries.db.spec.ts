import { eq } from 'drizzle-orm';
import { describe, it, expect, beforeAll } from 'vitest';
import { retiredUsernames, sessions, users } from '#db/schema/auth.ts';
import { db } from '#lib/server/db.ts';
import { trackWrites, writes } from '#db/test/writes.ts';
import { userValues } from '#db/test/users.ts';
import { foldUsername } from '#lib/media/utils/username.ts';
import {
	banUser,
	getUserById,
	usernameAvailability,
	updateProfile
} from '#lib/server/data/user-queries.ts';

const isUsernameAvailable = async (name: string, id: string) =>
	(await usernameAvailability(name, id)) === 'available';

const OLD = new Date('2020-01-01T00:00:00Z');

beforeAll(() => trackWrites('user'));

async function insertUser(values: typeof users.$inferInsert) {
	const [row] = await db
		.insert(users)
		.values({ createdAt: OLD, updatedAt: OLD, ...values })
		.returning();
	return row;
}

describe('getUserById', () => {
	it('reads a user without writing, and returns null for an unknown id', async () => {
		await insertUser(userValues('sub-1'));
		const before = await writes();
		expect((await getUserById('sub-1'))?.id).toBe('sub-1');
		expect(await getUserById('nobody')).toBeNull();
		expect(await writes()).toBe(before);
	});
});

describe('banUser', () => {
	it('sets the ban and ends every session of that user only', async () => {
		await insertUser(userValues('sub-1'));
		await insertUser(userValues('sub-2'));
		const base = { expiresAt: new Date(Date.now() + 60_000), ipAddress: null, userAgent: null };
		await db.insert(sessions).values([
			{ id: 's1', token: 't1', userId: 'sub-1', ...base },
			{ id: 's2', token: 't2', userId: 'sub-1', ...base },
			{ id: 's3', token: 't3', userId: 'sub-2', ...base }
		]);

		await banUser('sub-1', 'spam');

		const banned = await getUserById('sub-1');
		expect(banned?.bannedAt).toBeInstanceOf(Date);
		expect(banned?.banReason).toBe('spam');
		expect((await getUserById('sub-2'))?.bannedAt).toBeNull();
		const left = await db.select({ id: sessions.id }).from(sessions);
		expect(left).toEqual([{ id: 's3' }]);
	});
});

describe('updateProfile', () => {
	it('returns username-taken for a case-insensitive duplicate', async () => {
		await insertUser(userValues('sub-a', { username: 'Mary' }));
		await insertUser(userValues('sub-b'));
		expect(await updateProfile('sub-b', { username: 'mary' })).toEqual({
			ok: false,
			reason: 'username-taken'
		});
	});

	it.each([
		[{ username: 'ab' }, 'username-format'],
		[{ username: 'abc' }, 'username-format'],
		[{ username: 'a'.repeat(33) }, 'username-format'],
		[{ username: '1234' }, 'username-format'],
		[{ username: '9lives' }, 'username-format'],
		[{ username: '_ada' }, 'username-format'],
		[{ username: 'ada_' }, 'username-format'],
		[{ username: 'ada__bea' }, 'username-format'],
		[{ username: 'has space' }, 'username-format'],
		[{ username: 'Admin' }, 'username-reserved'],
		[{ avatarKey: 'not-an-avatar' }, 'avatar-invalid']
	])('rejects %o with %s', async (patch, reason) => {
		await insertUser(userValues('sub-a'));
		const before = await writes();
		expect(await updateProfile('sub-a', patch)).toEqual({ ok: false, reason });
		expect(await writes()).toBe(before);
	});

	it('stores a lowercased username and avatar, and bumps updated_at', async () => {
		await insertUser(userValues('sub-a'));
		const result = await updateProfile('sub-a', { username: 'Mary_W', avatarKey: 'kahlo' });
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.user).toMatchObject({ username: 'mary_w', avatarKey: 'kahlo' });
		expect(result.user.updatedAt.getTime()).toBeGreaterThan(OLD.getTime());
	});
});

describe('usernameAvailability', () => {
	it('names the first rule a name breaks, in the order updateProfile checks them', async () => {
		await insertUser(userValues('sub-a', { username: 'mary_w' }));
		expect(await usernameAvailability('ab', 'sub-b')).toBe('format');
		expect(await usernameAvailability('9lives', 'sub-b')).toBe('format');
		expect(await usernameAvailability('midb_fan', 'sub-b')).toBe('reserved');
		expect(await usernameAvailability('kill_yourself', 'sub-b')).toBe('blocked');
		expect(await usernameAvailability('mary_w', 'sub-b')).toBe('taken');
		expect(await usernameAvailability('adah', 'sub-b')).toBe('available');
	});
});

describe('availability as a yes or no', () => {
	it('matches case-insensitively', async () => {
		await insertUser(userValues('sub-a', { username: 'Mary' }));
		expect(await isUsernameAvailable('MARY', 'sub-b')).toBe(false);
		expect(await isUsernameAvailable('mary', 'sub-b')).toBe(false);
		expect(await isUsernameAvailable('adah', 'sub-b')).toBe(true);
	});

	it('excludes the requesting user', async () => {
		await insertUser(userValues('sub-a', { username: 'Mary' }));
		expect(await isUsernameAvailable('mary', 'sub-a')).toBe(true);
	});
});

const DAY = 86_400_000;
const daysAgo = (n: number) => new Date(Date.now() - n * DAY);

describe('updateProfile rules', () => {
	it('allows a name that only contains a reserved word inside a longer word part', async () => {
		await insertUser(userValues('sub-a'));
		expect(await updateProfile('sub-a', { username: 'rootsy_fan' })).toMatchObject({ ok: true });
	});

	it('refuses any change while muted, and allows one after the mute ends', async () => {
		await insertUser(userValues('sub-a', { mutedUntil: new Date(Date.now() + DAY) }));
		const before = await writes();
		expect(await updateProfile('sub-a', { username: 'adah' })).toEqual({
			ok: false,
			reason: 'muted'
		});
		expect(await updateProfile('sub-a', { avatarKey: 'kahlo' })).toEqual({
			ok: false,
			reason: 'muted'
		});
		expect(await writes()).toBe(before);

		await db.update(users).set({ mutedUntil: daysAgo(1) });
		expect(await updateProfile('sub-a', { username: 'adah' })).toMatchObject({ ok: true });
	});

	it('makes the first change free, stamps it, and retires the old name', async () => {
		await insertUser(userValues('sub-a', { username: 'Old_Name' }));
		const result = await updateProfile('sub-a', { username: 'new_name' });
		expect(result.ok).toBe(true);
		const row = await getUserById('sub-a');
		expect(row?.usernameChangedAt).toBeInstanceOf(Date);
		const retired = await db.select().from(retiredUsernames);
		expect(retired).toEqual([
			{
				username: 'old_name',
				userId: 'sub-a',
				retiredAt: expect.any(Date),
				usernameFolded: 'old_name'
			}
		]);
	});

	it('refuses a second change inside 30 days, and allows it after', async () => {
		await insertUser(userValues('sub-a', { username: 'ones', usernameChangedAt: daysAgo(29) }));
		expect(await updateProfile('sub-a', { username: 'twos' })).toEqual({
			ok: false,
			reason: 'username-too-soon'
		});
		expect((await getUserById('sub-a'))?.username).toBe('ones');

		await db.update(users).set({ usernameChangedAt: daysAgo(31) });
		expect(await updateProfile('sub-a', { username: 'twos' })).toMatchObject({ ok: true });
	});

	it('exempts staff from the wait', async () => {
		await insertUser(
			userValues('sub-a', { username: 'ones', role: 'moderator', usernameChangedAt: daysAgo(1) })
		);
		expect(await updateProfile('sub-a', { username: 'twos' })).toMatchObject({ ok: true });
	});

	it('does not count the username already held, or an avatar-only save, as a rename', async () => {
		await insertUser(userValues('sub-a', { username: 'ones', usernameChangedAt: daysAgo(1) }));
		expect(await updateProfile('sub-a', { username: 'Ones', avatarKey: 'kahlo' })).toMatchObject({
			ok: true
		});
		expect(await updateProfile('sub-a', { avatarKey: 'davis' })).toMatchObject({ ok: true });
		expect(await db.select().from(retiredUsernames)).toEqual([]);
		const row = await getUserById('sub-a');
		expect(row?.usernameChangedAt?.getTime()).toBeLessThan(Date.now() - DAY / 2);
	});

	it.each(['ab', 'a_b_c_', '9lives', 'admin_x', 'xmidbx'])(
		'saves an avatar for an account whose stored name %s breaks the new rules',
		async (stored) => {
			await insertUser(userValues('sub-a', { username: stored }));
			expect(await updateProfile('sub-a', { username: stored, avatarKey: 'kahlo' })).toMatchObject({
				ok: true,
				user: { username: stored, avatarKey: 'kahlo' }
			});
			expect(await updateProfile('sub-a', { avatarKey: 'davis' })).toMatchObject({ ok: true });
			expect(await db.select().from(retiredUsernames)).toEqual([]);
		}
	);

	it('still checks the shape of a name the account changes to', async () => {
		await insertUser(userValues('sub-a', { username: 'ab' }));
		expect(await updateProfile('sub-a', { username: 'abc' })).toEqual({
			ok: false,
			reason: 'username-format'
		});
		expect(await updateProfile('sub-a', { username: 'abcd', avatarKey: 'kahlo' })).toMatchObject({
			ok: true
		});
	});

	it('holds a retired name for others for 90 days, but not for its owner or after', async () => {
		await insertUser(userValues('sub-a', { username: 'adah' }));
		await insertUser(userValues('sub-b', { username: 'bear' }));
		await updateProfile('sub-a', { username: 'adah2' });

		expect(await updateProfile('sub-b', { username: 'adah' })).toEqual({
			ok: false,
			reason: 'username-taken'
		});
		expect(await isUsernameAvailable('ADAH', 'sub-b')).toBe(false);
		expect(await isUsernameAvailable('adah', 'sub-a')).toBe(true);

		await db.update(users).set({ usernameChangedAt: daysAgo(31) });
		expect(await updateProfile('sub-a', { username: 'adah' })).toMatchObject({ ok: true });

		await db.update(retiredUsernames).set({ retiredAt: daysAgo(91) });
		expect(await isUsernameAvailable('adah2', 'sub-b')).toBe(true);
		expect(await updateProfile('sub-b', { username: 'adah2' })).toMatchObject({ ok: true });
	});

	it('frees a retired name for others once its former account is gone', async () => {
		await insertUser(userValues('sub-a', { username: 'adah' }));
		await updateProfile('sub-a', { username: 'adah2' });
		await db.delete(users).where(eq(users.id, 'sub-a'));
		expect(await isUsernameAvailable('adah', 'sub-b')).toBe(true);
	});
});

describe('look-alike names', () => {
	it('refuses a look-alike of another account, in either direction', async () => {
		await insertUser(userValues('sub-a', { username: 'hello' }));
		await insertUser(userValues('sub-b', { username: 'so0n' }));
		await insertUser(userValues('sub-c'));
		for (const name of ['he1lo', 'HE11O', 'hell0']) {
			expect(await updateProfile('sub-c', { username: name })).toEqual({
				ok: false,
				reason: 'username-taken'
			});
			expect(await isUsernameAvailable(name, 'sub-c')).toBe(false);
		}
		expect(await updateProfile('sub-c', { username: 'soon' })).toEqual({
			ok: false,
			reason: 'username-taken'
		});
		expect(await updateProfile('sub-c', { username: 'helio' })).toMatchObject({ ok: true });
	});

	it('computes the folded column in SQL as foldUsername does', async () => {
		await insertUser(userValues('sub-a', { username: 'He110_W0rld' }));
		const row = await getUserById('sub-a');
		expect(row?.usernameFolded).toBe(foldUsername('He110_W0rld'));
		await updateProfile('sub-a', { username: 'n0w_here' });
		const [retired] = await db.select().from(retiredUsernames);
		expect(retired.usernameFolded).toBe(foldUsername('he110_w0rld'));
	});

	it('does not fold other characters', async () => {
		await insertUser(userValues('sub-a', { username: 'hello' }));
		expect(await isUsernameAvailable('he1io', 'sub-b')).toBe(true);
		expect(await isUsernameAvailable('hell_o', 'sub-b')).toBe(true);
	});

	it('lets an account take a look-alike of its own current name', async () => {
		await insertUser(userValues('sub-a', { username: 'hello' }));
		expect(await isUsernameAvailable('he11o', 'sub-a')).toBe(true);
		expect(await updateProfile('sub-a', { username: 'he11o' })).toMatchObject({ ok: true });
	});

	it('refuses a look-alike of a retired name for 90 days, except to its former owner', async () => {
		await insertUser(userValues('sub-a', { username: 'hello' }));
		await insertUser(userValues('sub-b'));
		await updateProfile('sub-a', { username: 'goodbye' });

		expect(await updateProfile('sub-b', { username: 'he11o' })).toEqual({
			ok: false,
			reason: 'username-taken'
		});
		expect(await isUsernameAvailable('he11o', 'sub-b')).toBe(false);
		expect(await isUsernameAvailable('he11o', 'sub-a')).toBe(true);

		await db.update(retiredUsernames).set({ retiredAt: daysAgo(91) });
		expect(await isUsernameAvailable('he11o', 'sub-b')).toBe(true);
	});

	it('answers availability as updateProfile does for shape and reserved names', async () => {
		await insertUser(userValues('sub-a'));
		for (const name of ['ab', '9lives', 'ada__bea', 'ada_', 'admin', 'x'.repeat(33)]) {
			expect(await isUsernameAvailable(name, 'sub-a')).toBe(false);
		}
		expect(await isUsernameAvailable('ada_bea', 'sub-a')).toBe(true);
	});
});
