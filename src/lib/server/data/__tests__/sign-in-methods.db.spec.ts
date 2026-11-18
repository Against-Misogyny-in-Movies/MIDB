import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '#lib/server/db.ts';
import { accounts, passkeys, users } from '#db/schema/auth.ts';
import { userValues } from '#db/test/users.ts';
import { getSignInMethodCounts } from '#lib/server/data/sign-in-methods.ts';

const account = (id: string, userId: string, providerId: string) => ({
	id,
	accountId: `ext-${id}`,
	providerId,
	userId,
	accessToken: 'secret-token'
});
const passkey = (id: string, userId: string) => ({
	id,
	userId,
	publicKey: 'pk',
	credentialID: `cred-${id}`,
	counter: 0,
	deviceType: 'multiDevice',
	backedUp: true
});

beforeEach(async () => {
	await db.insert(users).values([userValues('anna-id'), userValues('bea-id')]);
});

describe('getSignInMethodCounts', () => {
	it('counts the account’s linked providers and passkeys, and no one else’s', async () => {
		await db
			.insert(accounts)
			.values([
				account('a1', 'anna-id', 'google'),
				account('a2', 'anna-id', 'discord'),
				account('b1', 'bea-id', 'google')
			]);
		await db.insert(passkeys).values([passkey('p1', 'anna-id'), passkey('p2', 'bea-id')]);
		expect(await getSignInMethodCounts('anna-id')).toEqual({
			linked: ['discord', 'google'],
			passkeys: 1
		});
	});

	it('is empty for an account with no method', async () => {
		expect(await getSignInMethodCounts('anna-id')).toEqual({ linked: [], passkeys: 0 });
	});

	it('returns provider ids and a count only', async () => {
		await db.insert(accounts).values(account('a1', 'anna-id', 'google'));
		expect(JSON.stringify(await getSignInMethodCounts('anna-id'))).not.toContain('secret-token');
	});
});
