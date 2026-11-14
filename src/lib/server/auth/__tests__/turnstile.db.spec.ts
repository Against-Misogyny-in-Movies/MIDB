import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';
import { users } from '#db/schema/auth.ts';
import { userValues } from '#db/test/users.ts';
import { db } from '#lib/server/db.ts';
import { createAuth } from '../create-auth.ts';
import { PASSKEY_REGISTER_PATH } from '../turnstile.ts';

const SECRET = 'a-test-secret-of-at-least-thirty-two-characters';
const ORIGIN = 'http://localhost:5173';
const auth = createAuth({
	db,
	origin: ORIGIN,
	secret: SECRET,
	turnstileSecret: 'turnstile-secret'
});

const siteverify = vi.fn<(url: string, init: RequestInit) => Promise<Response>>();

beforeEach(() => {
	siteverify.mockReset();
	// Only Cloudflare's siteverify is faked; nothing else in these specs calls `fetch`.
	vi.stubGlobal('fetch', siteverify);
});

afterEach(() => {
	vi.unstubAllGlobals();
});

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

function registerOptions(headers: Record<string, string> = {}): Promise<Response> {
	return auth.handler(
		new Request(`${ORIGIN}/api/auth${PASSKEY_REGISTER_PATH}`, {
			headers: { origin: ORIGIN, 'cf-connecting-ip': '203.0.113.7', ...headers }
		})
	);
}

const verdict = (success: boolean) =>
	Response.json({ success, 'error-codes': success ? [] : ['invalid-input-response'] });

describe('the Turnstile check on a passkey registration', () => {
	it('refuses a sign-up without a token, and does not ask Cloudflare', async () => {
		const res = await registerOptions();
		expect(res.status).toBe(400);
		expect(await res.json()).toMatchObject({ code: 'MISSING_RESPONSE' });
		expect(siteverify).not.toHaveBeenCalled();
	});

	it('lets a sign-up through with a token Cloudflare accepts, sending the secret and the IP', async () => {
		siteverify.mockResolvedValue(verdict(true));
		const res = await registerOptions({ 'x-captcha-response': 'good-token' });
		expect(res.status).toBe(200);

		const [url, init] = siteverify.mock.calls[0];
		expect(url).toBe('https://challenges.cloudflare.com/turnstile/v0/siteverify');
		expect(JSON.parse(init.body as string)).toEqual({
			secret: 'turnstile-secret',
			response: 'good-token',
			remoteip: '203.0.113.7'
		});
	});

	it('refuses a sign-up with a token Cloudflare rejects', async () => {
		siteverify.mockResolvedValue(verdict(false));
		const res = await registerOptions({ 'x-captcha-response': 'bad-token' });
		expect(res.status).toBe(403);
		expect(await res.json()).toMatchObject({ code: 'VERIFICATION_FAILED' });
	});

	it('refuses a sign-up when Cloudflare cannot be reached', async () => {
		siteverify.mockRejectedValue(new Error('network'));
		const res = await registerOptions({ 'x-captcha-response': 'token' });
		expect(res.status).toBe(500);
		expect(await res.json()).toMatchObject({ code: 'UNKNOWN_ERROR' });
	});

	it('lets a signed-in reader add a passkey without a token', async () => {
		await db.insert(users).values(userValues('user-1'));
		const { internalAdapter } = await auth.$context;
		const { token } = await internalAdapter.createSession('user-1');

		const res = await registerOptions({ cookie: await sessionCookie(token) });

		expect(res.status).toBe(200);
		expect(siteverify).not.toHaveBeenCalled();
	});

	it('asks for the token again once the session is revoked', async () => {
		await db.insert(users).values(userValues('user-1'));
		const { internalAdapter } = await auth.$context;
		const { token } = await internalAdapter.createSession('user-1');
		await internalAdapter.deleteSession(token);

		const res = await registerOptions({ cookie: await sessionCookie(token) });

		expect(res.status).toBe(400);
	});

	it('is off with no secret on a local origin', async () => {
		const open = createAuth({ db, origin: ORIGIN, secret: SECRET });
		const res = await open.handler(
			new Request(`${ORIGIN}/api/auth${PASSKEY_REGISTER_PATH}`, { headers: { origin: ORIGIN } })
		);
		expect(res.status).toBe(200);
	});

	it('refuses a sign-up with no secret on a non-local origin, and logs it', async () => {
		const site = 'https://example.org';
		const error = vi.spyOn(console, 'error').mockImplementation(() => {});
		const open = createAuth({ db, origin: site, secret: SECRET });
		const res = await open.handler(
			new Request(`${site}/api/auth${PASSKEY_REGISTER_PATH}`, { headers: { origin: site } })
		);
		expect(res.status).toBe(503);
		expect(await res.json()).toMatchObject({ code: 'SIGN_UP_UNAVAILABLE' });
		expect(error).toHaveBeenCalledWith(expect.stringContaining('TURNSTILE_SECRET_KEY'));
		error.mockRestore();
	});

	it('lets a signed-in reader add a passkey with no secret on a non-local origin', async () => {
		const site = 'https://example.org';
		await db.insert(users).values(userValues('user-1'));
		const open = createAuth({ db, origin: site, secret: SECRET });
		const { token } = await (await open.$context).internalAdapter.createSession('user-1');
		const res = await open.handler(
			new Request(`${site}/api/auth${PASSKEY_REGISTER_PATH}`, {
				// An https origin makes Better Auth read the `__Secure-` cookie name.
				headers: { origin: site, cookie: `__Secure-${await sessionCookie(token)}` }
			})
		);
		expect(res.status).toBe(200);
	});
});
