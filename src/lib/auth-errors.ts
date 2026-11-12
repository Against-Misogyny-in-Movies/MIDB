/** The part of a Better Auth client error the messages read. */
export interface AuthClientError {
	status?: number;
	code?: string;
	message?: string;
	/** The WebAuthn error behind a passthrough code, when the client keeps it. */
	cause?: { name?: string };
}

type Action = 'sign-in' | 'sign-up' | 'add-passkey';

const TOO_MANY = 'Too many attempts. Wait a minute and try again.';

/** The code the server puts on a refused removal of the last sign-in method. */
export const LAST_METHOD_CODE = 'LAST_SIGN_IN_METHOD';

/** Codes Better Auth's captcha plugin and `guardPasskeySignUp` use for a failed check. */
const CAPTCHA_CODES = new Set(['VERIFICATION_FAILED', 'MISSING_RESPONSE']);

/** WebAuthn codes for a prompt the reader dismissed or that timed out. */
const CANCELLED = new Set(['AUTH_CANCELLED', 'ERROR_CEREMONY_ABORTED', 'REGISTRATION_CANCELLED']);

/** The browser's wording for a dismissed prompt when the WebAuthn error's name is not kept. */
const NOT_ALLOWED_MESSAGE = /not allowed|timed out|cancel|denied|abort/i;

const FALLBACK: Record<Action, string> = {
	'sign-in': 'The passkey could not be verified. Try again, or use another sign-in method.',
	'sign-up': 'The account could not be created. Try again.',
	'add-passkey': 'The passkey could not be added. Try again.'
};

/**
 * True for a prompt the reader dismissed or let time out. The browser reports that as a
 * `NotAllowedError`, which SimpleWebAuthn passes through as
 * `ERROR_PASSTHROUGH_SEE_CAUSE_PROPERTY`. Better Auth's client keeps only the code and the
 * message, so the cause's name is read when present and the browser's message otherwise.
 */
function isCancelled(error: AuthClientError): boolean {
	if (error.code && CANCELLED.has(error.code)) return true;
	if (error.code !== 'ERROR_PASSTHROUGH_SEE_CAUSE_PROPERTY') return false;
	return error.cause?.name === 'NotAllowedError' || NOT_ALLOWED_MESSAGE.test(error.message ?? '');
}

/**
 * True for a failed Turnstile check. Only a sign-up carries one, so a 403 from anywhere else
 * (the origin check, a ban) is not one.
 */
function isCaptchaFailure(error: AuthClientError): boolean {
	return error.code !== undefined && CAPTCHA_CODES.has(error.code);
}

/**
 * The sentence shown next to a failed passkey action. A rate limit, a ban, a failed Turnstile
 * check (sign-up only), a dismissed prompt and a duplicate passkey each get their own;
 * anything else gets the action's fallback.
 */
export function passkeyErrorMessage(error: AuthClientError, action: Action): string {
	if (error.status === 429) return TOO_MANY;
	if (error.status === 403 && /banned/i.test(error.message ?? '')) {
		return 'This account is banned.';
	}
	if (action === 'sign-up' && isCaptchaFailure(error)) {
		return 'The check against automated sign-ups failed. Try again.';
	}
	if (error.code === 'ERROR_AUTHENTICATOR_PREVIOUSLY_REGISTERED') {
		return action === 'add-passkey'
			? 'This passkey is already on this account.'
			: 'This passkey is already registered. Sign in with it instead.';
	}
	if (isCancelled(error)) return 'The passkey request was cancelled or timed out. Try again.';
	return FALLBACK[action];
}

/**
 * The sentence for a failed change on the sign-in methods page (remove, rename, delete). A
 * rate limit and the last-method refusal are named; a dead session says so; anything else
 * gets the caller's fallback.
 */
export function methodErrorMessage(error: AuthClientError, fallback: string): string {
	if (error.status === 429) return TOO_MANY;
	if (error.status === 401) return 'The session has ended. Sign in again.';
	if (error.code === LAST_METHOD_CODE && error.message) return error.message;
	return fallback;
}

/** The sentence for the `?error=` a provider sign-in or link redirects back with. */
export function providerErrorMessage(code: string): string {
	if (code === 'access_denied') return 'The provider sign-in was cancelled.';
	if (code === 'account_already_linked_to_different_user') {
		return 'That account is already linked to another MIDB account.';
	}
	return 'The provider sign-in failed. Try again.';
}
