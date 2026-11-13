import { eq } from 'drizzle-orm';
import { describe, it, expect, beforeAll } from 'vitest';
import { retiredUsernames, sessions, users } from '#db/schema/auth.ts';
import { db } from '#lib/server/db.ts';
import { trackWrites, writes } from '#db/test/writes.ts';
import { userValues } from '#db/test/users.ts';
import {
	banUser,
	getUserById,
	isUsernameAvailable,
	updateProfile
} from '#lib/server/data/user-queries.ts';

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

describe('isUsernameAvailable', () => {
	it('matches case-insensitively', async () => {
		await insertUser(userValues('sub-a', { username: 'Mary' }));
		expect(await isUsernameAvailable('MARY', 'sub-b')).toBe(false);
		expect(await isUsernameAvailable('mary', 'sub-b')).toBe(false);
		expect(await isUsernameAvailable('ada', 'sub-b')).toBe(true);
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
		expect(await updateProfile('sub-a', { username: 'ada' })).toEqual({
			ok: false,
			reason: 'muted'
		});
		expect(await updateProfile('sub-a', { avatarKey: 'kahlo' })).toEqual({
			ok: false,
			reason: 'muted'
		});
		expect(await writes()).toBe(before);

		await db.update(users).set({ mutedUntil: daysAgo(1) });
		expect(await updateProfile('sub-a', { username: 'ada' })).toMatchObject({ ok: true });
	});

	it('makes the first change free, stamps it, and retires the old name', async () => {
		await insertUser(userValues('sub-a', { username: 'Old_Name' }));
		const result = await updateProfile('sub-a', { username: 'new_name' });
		expect(result.ok).toBe(true);
		const row = await getUserById('sub-a');
		expect(row?.usernameChangedAt).toBeInstanceOf(Date);
		const retired = await db.select().from(retiredUsernames);
		expect(retired).toEqual([
			{ username: 'old_name', userId: 'sub-a', retiredAt: expect.any(Date) }
		]);
	});

	it('refuses a second change inside 30 days, and allows it after', async () => {
		await insertUser(userValues('sub-a', { username: 'one', usernameChangedAt: daysAgo(29) }));
		expect(await updateProfile('sub-a', { username: 'two' })).toEqual({
			ok: false,
			reason: 'username-too-soon'
		});
		expect((await getUserById('sub-a'))?.username).toBe('one');

		await db.update(users).set({ usernameChangedAt: daysAgo(31) });
		expect(await updateProfile('sub-a', { username: 'two' })).toMatchObject({ ok: true });
	});

	it('exempts staff from the wait', async () => {
		await insertUser(
			userValues('sub-a', { username: 'one', role: 'moderator', usernameChangedAt: daysAgo(1) })
		);
		expect(await updateProfile('sub-a', { username: 'two' })).toMatchObject({ ok: true });
	});

	it('does not count the username already held, or an avatar-only save, as a rename', async () => {
		await insertUser(userValues('sub-a', { username: 'one', usernameChangedAt: daysAgo(1) }));
		expect(await updateProfile('sub-a', { username: 'One', avatarKey: 'kahlo' })).toMatchObject({
			ok: true
		});
		expect(await updateProfile('sub-a', { avatarKey: 'davis' })).toMatchObject({ ok: true });
		expect(await db.select().from(retiredUsernames)).toEqual([]);
		const row = await getUserById('sub-a');
		expect(row?.usernameChangedAt?.getTime()).toBeLessThan(Date.now() - DAY / 2);
	});

	it('holds a retired name for others for 90 days, but not for its owner or after', async () => {
		await insertUser(userValues('sub-a', { username: 'ada' }));
		await insertUser(userValues('sub-b', { username: 'bea' }));
		await updateProfile('sub-a', { username: 'ada2' });

		expect(await updateProfile('sub-b', { username: 'ada' })).toEqual({
			ok: false,
			reason: 'username-taken'
		});
		expect(await isUsernameAvailable('ADA', 'sub-b')).toBe(false);
		expect(await isUsernameAvailable('ada', 'sub-a')).toBe(true);

		await db.update(users).set({ usernameChangedAt: daysAgo(31) });
		expect(await updateProfile('sub-a', { username: 'ada' })).toMatchObject({ ok: true });

		await db.update(retiredUsernames).set({ retiredAt: daysAgo(91) });
		expect(await isUsernameAvailable('ada2', 'sub-b')).toBe(true);
		expect(await updateProfile('sub-b', { username: 'ada2' })).toMatchObject({ ok: true });
	});

	it('frees a retired name for others once its former account is gone', async () => {
		await insertUser(userValues('sub-a', { username: 'ada' }));
		await updateProfile('sub-a', { username: 'ada2' });
		await db.delete(users).where(eq(users.id, 'sub-a'));
		expect(await isUsernameAvailable('ada', 'sub-b')).toBe(true);
	});
});
