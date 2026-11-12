import { createAuthClient } from 'better-auth/client';
import { passkeyClient } from '@better-auth/passkey/client';

/** Better Auth's client for `/api/auth`: sign-in, sign-out, linked accounts and passkeys. */
export const authClient = createAuthClient({ plugins: [passkeyClient()] });

/**
 * A client whose requests carry a Turnstile token (`x-captcha-response`), for passkey sign-up.
 * Better Auth's `addPasskey` sends no per-call headers on the request the check guards, so
 * the header is set on the client; one is built per sign-up attempt, as a token is single-use.
 */
export function createCaptchaClient(token: string) {
	return createAuthClient({
		plugins: [passkeyClient()],
		fetchOptions: { headers: { 'x-captcha-response': token } }
	});
}
