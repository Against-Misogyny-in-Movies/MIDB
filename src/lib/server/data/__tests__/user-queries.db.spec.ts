import { describe, it, expect, beforeAll } from 'vitest';
import { sessions, users } from '#db/schema/auth.ts';
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
