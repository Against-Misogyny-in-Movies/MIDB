import { describe, it, expect } from 'vitest';
import { accounts, passkeys, sessions, users } from '#db/schema/auth.ts';
import { cleanupOrphans, ORPHAN_AFTER_MS } from '#db/scripts/cleanup-orphans.ts';
import { userValues } from '#db/test/users.ts';
import { db } from '#lib/server/db.ts';

const NOW = new Date('2026-11-12T10:00:00Z');
const old = new Date(NOW.getTime() - ORPHAN_AFTER_MS - 60_000);
const recent = new Date(NOW.getTime() - ORPHAN_AFTER_MS + 60_000);

const account = (id: string, userId: string) => ({
	id,
	accountId: id,
	providerId: 'google',
	userId
});
const passkey = (id: string, userId: string) => ({
	id,
	publicKey: 'k',
	userId,
	credentialID: id,
	counter: 0,
	deviceType: 'singleDevice',
	backedUp: false
});

const remaining = async () => (await db.select({ id: users.id }).from(users)).map((u) => u.id);

describe('cleanupOrphans', () => {
	it('removes an old user with no account, no passkey and no session', async () => {
		await db.insert(users).values(userValues('orphan', { createdAt: old }));
		expect(await cleanupOrphans(db, NOW)).toBe(1);
		expect(await remaining()).toEqual([]);
	});

	it('keeps an old user that has a session', async () => {
		await db.insert(users).values(userValues('signed-in', { createdAt: old }));
		await db.insert(sessions).values({
			id: 's1',
			token: 't1',
			userId: 'signed-in',
			expiresAt: new Date(NOW.getTime() + 1000)
		});
		expect(await cleanupOrphans(db, NOW)).toBe(0);
		expect(await remaining()).toEqual(['signed-in']);
	});

	it('keeps a user created within the hour', async () => {
		await db.insert(users).values(userValues('fresh', { createdAt: recent }));
		expect(await cleanupOrphans(db, NOW)).toBe(0);
		expect(await remaining()).toEqual(['fresh']);
	});

	it('keeps an old user with an account or a passkey', async () => {
		await db
			.insert(users)
			.values([
				userValues('with-account', { createdAt: old }),
				userValues('with-passkey', { createdAt: old }),
				userValues('orphan', { createdAt: old })
			]);
		await db.insert(accounts).values(account('a1', 'with-account'));
		await db.insert(passkeys).values(passkey('p1', 'with-passkey'));

		expect(await cleanupOrphans(db, NOW)).toBe(1);
		expect((await remaining()).sort()).toEqual(['with-account', 'with-passkey']);
	});
});
