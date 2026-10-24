import { describe, it, expect } from 'vitest';
import { eq, sql } from 'drizzle-orm';
import { users } from '$db/schema/auth';
import { db } from '$lib/server/db';
import { getOrCreateUser, isUsernameAvailable, updateProfile } from '$lib/server/data/user-queries';

const OLD = new Date('2020-01-01T00:00:00Z');

async function xmin(id: string): Promise<string> {
	const rows = await db.execute<{ xmin: string }>(
		sql`SELECT xmin::text AS xmin FROM ${users} WHERE ${users.id} = ${id}`
	);
	return rows[0].xmin;
}

async function count(id: string): Promise<number> {
	const rows = await db.select().from(users).where(eq(users.id, id));
	return rows.length;
}

async function insertUser(values: typeof users.$inferInsert) {
	const [row] = await db
		.insert(users)
		.values({ createdAt: OLD, updatedAt: OLD, ...values })
		.returning();
	return row;
}

describe('getOrCreateUser', () => {
	it('inserts the row on the first call', async () => {
		const user = await getOrCreateUser({ sub: 'sub-1', email: 'mary@example.com' });
		expect(user).toMatchObject({ id: 'sub-1', email: 'mary@example.com', role: 'user' });
		expect(await count('sub-1')).toBe(1);
	});

	it('does no write on a repeat call (xmin unchanged)', async () => {
		await getOrCreateUser({ sub: 'sub-1', email: 'mary@example.com' });
		const before = await xmin('sub-1');
		const again = await getOrCreateUser({ sub: 'sub-1', email: 'mary@example.com' });
		expect(again.id).toBe('sub-1');
		expect(await xmin('sub-1')).toBe(before);
	});

	it('does no write on a repeat call without an email claim', async () => {
		await getOrCreateUser({ sub: 'sub-1', email: null });
		const before = await xmin('sub-1');
		await getOrCreateUser({ sub: 'sub-1', email: null });
		expect(await xmin('sub-1')).toBe(before);
	});

	it('backfills the email when the stored value is null, without bumping updated_at', async () => {
		await insertUser({ id: 'sub-1', email: null });
		const user = await getOrCreateUser({ sub: 'sub-1', email: 'mary@example.com' });
		expect(user.email).toBe('mary@example.com');
		expect(user.updatedAt).toEqual(OLD);
	});

	it('never overwrites a stored email', async () => {
		await insertUser({ id: 'sub-1', email: 'mary@example.com' });
		const before = await xmin('sub-1');
		const user = await getOrCreateUser({ sub: 'sub-1', email: 'other@example.com' });
		expect(user.email).toBe('mary@example.com');
		expect(await xmin('sub-1')).toBe(before);
	});

	it('resolves two concurrent first calls for one sub to a single row', async () => {
		const [a, b] = await Promise.all([
			getOrCreateUser({ sub: 'sub-race', email: 'race@example.com' }),
			getOrCreateUser({ sub: 'sub-race', email: 'race@example.com' })
		]);
		expect(a.id).toBe('sub-race');
		expect(b.id).toBe('sub-race');
		expect(a.createdAt).toEqual(b.createdAt);
		expect(await count('sub-race')).toBe(1);
	});
});

describe('updateProfile', () => {
	it('returns username-taken for a case-insensitive duplicate', async () => {
		await insertUser({ id: 'sub-a', username: 'Mary' });
		await insertUser({ id: 'sub-b' });
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
		await insertUser({ id: 'sub-a' });
		const before = await xmin('sub-a');
		expect(await updateProfile('sub-a', patch)).toEqual({ ok: false, reason });
		expect(await xmin('sub-a')).toBe(before);
	});

	it('stores a lowercased username and avatar, and bumps updated_at', async () => {
		await insertUser({ id: 'sub-a' });
		const result = await updateProfile('sub-a', { username: 'Mary_W', avatarKey: 'kahlo' });
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.user).toMatchObject({ username: 'mary_w', avatarKey: 'kahlo' });
		expect(result.user.updatedAt.getTime()).toBeGreaterThan(OLD.getTime());
	});
});

describe('isUsernameAvailable', () => {
	it('matches case-insensitively', async () => {
		await insertUser({ id: 'sub-a', username: 'Mary' });
		expect(await isUsernameAvailable('MARY', 'sub-b')).toBe(false);
		expect(await isUsernameAvailable('mary', 'sub-b')).toBe(false);
		expect(await isUsernameAvailable('ada', 'sub-b')).toBe(true);
	});

	it('excludes the requesting user', async () => {
		await insertUser({ id: 'sub-a', username: 'Mary' });
		expect(await isUsernameAvailable('mary', 'sub-a')).toBe(true);
	});
});
