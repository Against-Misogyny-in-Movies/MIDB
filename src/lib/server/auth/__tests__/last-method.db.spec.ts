import { describe, it, expect } from 'vitest';
import { eq } from 'drizzle-orm';
import { accounts, passkeys, sessions, users } from '#db/schema/auth.ts';
import { userValues } from '#db/test/users.ts';
import { db } from '#lib/server/db.ts';
import { createAuth } from '../create-auth.ts';
import { LAST_METHOD_MESSAGE } from '../last-method.ts';

const SECRET = 'a-test-secret-of-at-least-thirty-two-characters';
const ORIGIN = 'http://localhost:5173';
const auth = createAuth({ db, origin: ORIGIN, secret: SECRET });

/** The signed `better-auth.session_token` cookie, as the browser sends it. */
async function sessionCookie(token: string): Promise<string> {
	const key = await crypto.subtle.importKey(
		'raw',
		new TextEncoder().encode(SECRET),
		{ name: 'HMAC', hash: 'SHA-256' },
		false,
		['sign']
	);
	const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(token));
	const signature = btoa(String.fromCharCode(...new Uint8Array(sig)));
	return `better-auth.session_token=${encodeURIComponent(`${token}.${signature}`)}`;
}

/** A POST to an auth endpoint with the given `Cookie` header. */
function postWithCookie(path: string, body: object, cookie: string): Promise<Response> {
	return auth.handler(
		new Request(`${ORIGIN}/api/auth${path}`, {
			method: 'POST',
			headers: { 'content-type': 'application/json', origin: ORIGIN, cookie },
			body: JSON.stringify(body)
		})
	);
}

async function post(path: string, body: object, token: string): Promise<Response> {
	return postWithCookie(path, body, await sessionCookie(token));
}

const account = (id: string) => ({ id, accountId: id, providerId: 'google', userId: 'user-1' });
const passkey = (id: string) => ({
	id,
	publicKey: 'k',
	userId: 'user-1',
	credentialID: id,
	counter: 0,
	deviceType: 'singleDevice',
	backedUp: false
});

let token: string;

async function signedIn(): Promise<string> {
	await db.insert(users).values(userValues('user-1'));
	const { internalAdapter } = await auth.$context;
	token = (await internalAdapter.createSession('user-1')).token;
	return token;
}

const remaining = async () => ({
	accounts: (await db.select().from(accounts)).length,
	passkeys: (await db.select().from(passkeys)).length
});

describe('the last sign-in method', () => {
	it('refuses to delete the only passkey', async () => {
		await signedIn();
		await db.insert(passkeys).values(passkey('p1'));

		const res = await post('/passkey/delete-passkey', { id: 'p1' }, token);
		expect(res.status).toBe(400);
		expect(await res.json()).toMatchObject({ message: LAST_METHOD_MESSAGE });
		expect(await remaining()).toEqual({ accounts: 0, passkeys: 1 });
	});

	it('refuses to unlink the only account', async () => {
		await signedIn();
		await db.insert(accounts).values(account('a1'));

		const res = await post('/unlink-account', { accountId: 'a1' }, token);
		expect(res.status).toBe(400);
		expect(await remaining()).toEqual({ accounts: 1, passkeys: 0 });
	});

	it('lets a passkey go when an account remains, and an account go when a passkey remains', async () => {
		await signedIn();
		await db.insert(accounts).values(account('a1'));
		await db.insert(passkeys).values(passkey('p1'));

		expect((await post('/passkey/delete-passkey', { id: 'p1' }, token)).status).toBe(200);
		expect(await remaining()).toEqual({ accounts: 1, passkeys: 0 });

		await db.insert(passkeys).values(passkey('p2'));
		const res = await post('/unlink-account', { accountId: 'a1' }, token);
		expect(res.status).toBe(200);
		expect(await remaining()).toEqual({ accounts: 0, passkeys: 1 });
	});

	it('lets one of two passkeys go', async () => {
		await signedIn();
		await db.insert(passkeys).values([passkey('p1'), passkey('p2')]);
		expect((await post('/passkey/delete-passkey', { id: 'p1' }, token)).status).toBe(200);
		expect(await remaining()).toEqual({ accounts: 0, passkeys: 1 });
	});

	it('refuses both removals from a revoked session that still holds a session_data cookie', async () => {
		await signedIn();
		await db.insert(accounts).values(account('a1'));
		await db.insert(passkeys).values([passkey('p1'), passkey('p2')]);

		// Better Auth sets the cache cookie when it answers `get-session`.
		const cookie = await sessionCookie(token);
		const res = await auth.handler(
			new Request(`${ORIGIN}/api/auth/get-session`, { headers: { cookie } })
		);
		const dataCookie = res.headers
			.getSetCookie()
			.map((c) => c.split(';')[0])
			.find((c) => c.includes('session_data'));
		expect(dataCookie).toBeDefined();

		await db.delete(sessions).where(eq(sessions.userId, 'user-1'));

		const both = `${cookie}; ${dataCookie}`;
		expect((await postWithCookie('/unlink-account', { accountId: 'a1' }, both)).status).toBe(401);
		expect((await postWithCookie('/passkey/delete-passkey', { id: 'p1' }, both)).status).toBe(401);
		expect(await remaining()).toEqual({ accounts: 1, passkeys: 2 });
	});
});
