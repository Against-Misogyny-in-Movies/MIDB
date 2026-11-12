/** The part of a Better Auth client error the messages read. */
export interface AuthClientError {
	status?: number;
	code?: string;
	message?: string;
}

type Action = 'sign-in' | 'sign-up' | 'add-passkey';

/** WebAuthn codes for a prompt the reader dismissed or that timed out. */
const CANCELLED = new Set([
	'AUTH_CANCELLED',
	'ERROR_CEREMONY_ABORTED',
	'REGISTRATION_CANCELLED',
	'NotAllowedError'
]);

const FALLBACK: Record<Action, string> = {
	'sign-in': 'The passkey could not be verified. Try again, or use another sign-in method.',
	'sign-up': 'The account could not be created. Try again.',
	'add-passkey': 'The passkey could not be added. Try again.'
};

/**
 * The sentence shown next to a failed passkey action. A dismissed prompt, a duplicate
 * passkey, a failed Turnstile check, a ban and a rate limit each get their own; anything else
 * gets the action's fallback.
 */
export function passkeyErrorMessage(error: AuthClientError, action: Action): string {
	if (error.status === 429) return 'Too many attempts. Wait a minute and try again.';
	if (error.status === 403 && /banned/i.test(error.message ?? '')) {
		return 'This account is banned.';
	}
	if (error.status === 403 || /captcha/i.test(`${error.code ?? ''} ${error.message ?? ''}`)) {
		return 'The check against automated sign-ups failed. Try again.';
	}
	if (error.code === 'ERROR_AUTHENTICATOR_PREVIOUSLY_REGISTERED') {
		return 'This passkey is already registered. Sign in with it instead.';
	}
	if (error.code && CANCELLED.has(error.code)) {
		return 'The passkey request was cancelled or timed out. Try again.';
	}
	return FALLBACK[action];
}

/** The sentence for the `?error=` a provider sign-in or link redirects back with. */
export function providerErrorMessage(code: string): string {
	if (code === 'access_denied') return 'The provider sign-in was cancelled.';
	if (code === 'account_already_linked_to_different_user') {
		return 'That account is already linked to another MIDB account.';
	}
	return 'The provider sign-in failed. Try again.';
}
