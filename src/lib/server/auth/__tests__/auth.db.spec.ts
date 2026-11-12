import { describe, it, expect, beforeAll } from 'vitest';
import { eq } from 'drizzle-orm';
import type { Account } from 'better-auth';
import { handleOAuthUserInfo } from 'better-auth/oauth2';
import { accounts, sessions, users } from '#db/schema/auth.ts';
import { userValues } from '#db/test/users.ts';
import { db } from '#lib/server/db.ts';
import { banUser } from '#lib/server/data/user-queries.ts';
import { createAuth } from '../create-auth.ts';
import { adoptProviderEmail } from '../link-email.ts';
import { createPasskeyUser, resolveNewPasskeyUser } from '../passkey-signup.ts';
import type { AuthEndpointContext } from '../types.ts';

// A real Better Auth instance over the local D1: no network, no provider secrets.
const auth = createAuth({
	db,
	origin: 'http://localhost:5173',
	secret: 'a-test-secret-of-at-least-thirty-two-characters'
});

let internalAdapter: Awaited<typeof auth.$context>['internalAdapter'];

beforeAll(async () => {
	({ internalAdapter } = await auth.$context);
});

const asCtx = (extra: object = {}) =>
	({ context: { internalAdapter, ...extra } }) as unknown as AuthEndpointContext;

describe('the secret', () => {
	it('refuses to start without one on a non-local origin', () => {
		expect(() => createAuth({ db, origin: 'https://midb.example' })).toThrow(/BETTER_AUTH_SECRET/);
	});

	it('starts without one on localhost, and with one anywhere', () => {
		expect(() => createAuth({ db, origin: 'http://localhost:5173' })).not.toThrow();
		expect(() =>
			createAuth({ db, origin: 'https://midb.example', secret: 'x'.repeat(40) })
		).not.toThrow();
	});
});

describe('passkey sign-up', () => {
	it('resolves a fresh user each time', () => {
		expect(resolveNewPasskeyUser().id).not.toBe(resolveNewPasskeyUser().id);
	});

	it('creates the account with the placeholder email and an unverified address', async () => {
		const resolved = resolveNewPasskeyUser();
		const { userId } = await createPasskeyUser(asCtx(), resolved);

		const [row] = await db.select().from(users).where(eq(users.id, userId));
		expect(userId).toBe(resolved.id);
		expect(row.email).toBe(`${resolved.id}@users.invalid`);
		expect(row.emailVerified).toBe(false);
		expect(row.role).toBe('user');
		expect(row.username).toBeNull();
		expect(row.bannedAt).toBeNull();
	});

	it('creates nothing when the user already exists (a signed-in user adding a passkey)', async () => {
		await db.insert(users).values(userValues('user-1'));
		const result = await createPasskeyUser(asCtx(), { id: 'user-1', name: 'x' });
		expect(result).toEqual({ userId: 'user-1' });
		expect(await db.select().from(users)).toHaveLength(1);
	});
});

describe('session.create hook', () => {
	it('lets a normal user start a session', async () => {
		await db.insert(users).values(userValues('user-1'));
		const session = await internalAdapter.createSession('user-1');
		expect(session.userId).toBe('user-1');
		expect(await db.select().from(sessions)).toHaveLength(1);
	});

	it('refuses a session for a banned user with FORBIDDEN', async () => {
		await db.insert(users).values(userValues('user-1', { bannedAt: new Date() }));
		await expect(internalAdapter.createSession('user-1')).rejects.toMatchObject({
			status: 'FORBIDDEN'
		});
		expect(await db.select().from(sessions)).toHaveLength(0);
	});

	it('refuses a new session after a ban, and the ban ended the old ones', async () => {
		await db.insert(users).values(userValues('user-1'));
		await internalAdapter.createSession('user-1');
		await internalAdapter.createSession('user-1');
		expect(await db.select().from(sessions)).toHaveLength(2);

		await banUser('user-1', 'spam');

		expect(await db.select().from(sessions)).toHaveLength(0);
		await expect(internalAdapter.createSession('user-1')).rejects.toMatchObject({
			status: 'FORBIDDEN'
		});
	});
});

describe('adoptProviderEmail against the database', () => {
	const account = { userId: 'user-1', providerId: 'google', accessToken: 'at' } as Account;
	const provider = (email: string) => ({
		id: 'google',
		getUserInfo: async () => ({ user: { email, emailVerified: true } })
	});
	const ctxWith = (email: string) =>
		asCtx({ socialProviders: [provider(email)], logger: { warn: () => {} } });

	it('stores the verified provider email on a placeholder account', async () => {
		await db.insert(users).values(userValues('user-1', { email: 'user-1@users.invalid' }));
		await adoptProviderEmail(account, ctxWith('Mary@Example.com'));
		const [row] = await db.select().from(users).where(eq(users.id, 'user-1'));
		expect(row.email).toBe('mary@example.com');
		expect(row.emailVerified).toBe(true);
	});

	it('keeps the placeholder when another user already has that email', async () => {
		await db.insert(users).values(userValues('user-1', { email: 'user-1@users.invalid' }));
		await db.insert(users).values(userValues('user-2', { email: 'mary@example.com' }));
		await adoptProviderEmail(account, ctxWith('mary@example.com'));
		const [row] = await db.select().from(users).where(eq(users.id, 'user-1'));
		expect(row.email).toBe('user-1@users.invalid');
	});
});

describe('account linking', () => {
	const ctx = async () => ({ context: await auth.$context });
	const signIn = async (providerId: string, emailVerified: boolean) =>
		handleOAuthUserInfo((await ctx()) as unknown as Parameters<typeof handleOAuthUserInfo>[0], {
			userInfo: {
				id: 'provider-id',
				email: 'mary@example.com',
				emailVerified,
				name: 'Mary'
			},
			account: { providerId, accountId: 'provider-id', accessToken: 'at' }
		});

	it('does not bind an unverified Discord email to the user who has that email', async () => {
		await db
			.insert(users)
			.values(userValues('user-1', { email: 'mary@example.com', emailVerified: true }));

		const result = await signIn('discord', false);

		expect(result.error).toBe('account not linked');
		expect(await db.select().from(accounts)).toHaveLength(0);
		expect(await db.select().from(users)).toHaveLength(1);
	});

	it('links Discord once it reports the email verified', async () => {
		await db
			.insert(users)
			.values(userValues('user-1', { email: 'mary@example.com', emailVerified: true }));

		const result = await signIn('discord', true);

		expect(result.error).toBeNull();
		const rows = await db.select().from(accounts);
		expect(rows).toHaveLength(1);
		expect(rows[0]).toMatchObject({ userId: 'user-1', providerId: 'discord' });
	});
});
