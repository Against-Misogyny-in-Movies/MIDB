import { APIError, getAuthoritativeSessionFromCtx, getIP } from 'better-auth/api';
import { SIGN_UP_UNAVAILABLE_CODE } from '#lib/auth-errors.ts';
import { isLocalOrigin } from '#lib/server/http/origin.ts';
import type { AuthEndpointContext } from './types.ts';

/** Better Auth's endpoint that starts a passkey registration: a sign-up, or an added passkey. */
export const PASSKEY_REGISTER_PATH = '/passkey/generate-register-options';

const SITEVERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
/** The same bound Better Auth's captcha plugin puts on its verification request. */
const VERIFY_TIMEOUT_MS = 10_000;

/** The header the browser sends the Turnstile token in (`createCaptchaClient`). */
const TOKEN_HEADER = 'x-captcha-response';

/**
 * Asks Cloudflare whether a Turnstile token is valid, as Better Auth's captcha plugin does
 * (its verifier is not exported): a JSON POST of the secret, the token and the client IP.
 * `unavailable` covers a network failure, a timeout and a response that is not a verdict.
 */
export async function verifyTurnstile(
	secret: string,
	token: string,
	remoteIp?: string
): Promise<'valid' | 'invalid' | 'unavailable'> {
	try {
		const res = await fetch(SITEVERIFY_URL, {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ secret, response: token, ...(remoteIp && { remoteip: remoteIp }) }),
			signal: AbortSignal.timeout(VERIFY_TIMEOUT_MS)
		});
		if (!res.ok) return 'unavailable';
		const verdict = (await res.json()) as { success?: boolean };
		return verdict.success === true ? 'valid' : 'invalid';
	} catch {
		return 'unavailable';
	}
}

/**
 * `hooks.before` step: a passkey registration with no session (a sign-up) must carry a valid
 * Turnstile token. A signed-in reader adding a passkey is not a sign-up and needs none. The
 * session is read from the database, so a revoked cookie does not skip the check. The error
 * codes are the captcha plugin's (`MISSING_RESPONSE`, `VERIFICATION_FAILED`, `UNKNOWN_ERROR`)
 * and `SIGN_UP_UNAVAILABLE_CODE`, which `#lib/auth-errors.ts` maps. With no secret, a sign-up is
 * refused (`SIGN_UP_UNAVAILABLE_CODE`) unless the site's origin is local, so a missing secret
 * cannot switch the check off in production.
 */
export async function guardPasskeySignUp(
	ctx: AuthEndpointContext,
	turnstileSecret: string | undefined,
	origin: string
): Promise<void> {
	if (ctx.path !== PASSKEY_REGISTER_PATH) return;
	if (!turnstileSecret && isLocalOrigin(origin)) return;
	if (await getAuthoritativeSessionFromCtx(ctx)) return;
	if (!turnstileSecret) {
		console.error('[auth] TURNSTILE_SECRET_KEY is missing: passkey sign-ups are refused');
		throw new APIError('SERVICE_UNAVAILABLE', {
			message: 'Account creation is not available right now.',
			code: SIGN_UP_UNAVAILABLE_CODE
		});
	}

	const token = ctx.headers?.get(TOKEN_HEADER);
	if (!token) {
		throw new APIError('BAD_REQUEST', {
			message: 'Missing CAPTCHA response',
			code: 'MISSING_RESPONSE'
		});
	}
	const source = ctx.request ?? ctx.headers;
	const ip = source ? (getIP(source, ctx.context.options) ?? undefined) : undefined;
	const verdict = await verifyTurnstile(turnstileSecret, token, ip);
	if (verdict === 'invalid') {
		throw new APIError('FORBIDDEN', {
			message: 'Captcha verification failed',
			code: 'VERIFICATION_FAILED'
		});
	}
	if (verdict === 'unavailable') {
		throw new APIError('INTERNAL_SERVER_ERROR', {
			message: 'Something went wrong',
			code: 'UNKNOWN_ERROR'
		});
	}
}
