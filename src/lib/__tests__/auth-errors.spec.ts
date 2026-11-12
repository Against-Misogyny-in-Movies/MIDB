import { describe, it, expect } from 'vitest';
import { passkeyErrorMessage, providerErrorMessage } from '#lib/auth-errors.ts';

describe('passkeyErrorMessage', () => {
	it('names a rate limit', () => {
		expect(passkeyErrorMessage({ status: 429 }, 'sign-in')).toMatch(/Too many attempts/);
	});

	it('names a ban, and a failed Turnstile check', () => {
		expect(
			passkeyErrorMessage({ status: 403, message: 'This account is banned.' }, 'sign-in')
		).toBe('This account is banned.');
		expect(
			passkeyErrorMessage(
				{ status: 403, code: 'VERIFICATION_FAILED', message: 'Captcha' },
				'sign-up'
			)
		).toMatch(/automated sign-ups/);
		expect(
			passkeyErrorMessage(
				{ code: 'MISSING_RESPONSE', message: 'Missing CAPTCHA response' },
				'sign-up'
			)
		).toMatch(/automated sign-ups/);
	});

	it('names a duplicate passkey and a dismissed prompt', () => {
		expect(
			passkeyErrorMessage({ code: 'ERROR_AUTHENTICATOR_PREVIOUSLY_REGISTERED' }, 'add-passkey')
		).toMatch(/already registered/);
		expect(passkeyErrorMessage({ code: 'AUTH_CANCELLED' }, 'sign-in')).toMatch(/cancelled/);
		expect(passkeyErrorMessage({ code: 'ERROR_CEREMONY_ABORTED' }, 'sign-up')).toMatch(/cancelled/);
	});

	it('falls back per action', () => {
		expect(passkeyErrorMessage({}, 'sign-in')).toMatch(/could not be verified/);
		expect(passkeyErrorMessage({ status: 500 }, 'sign-up')).toMatch(/could not be created/);
		expect(passkeyErrorMessage({}, 'add-passkey')).toMatch(/could not be added/);
	});
});

describe('providerErrorMessage', () => {
	it('maps a cancelled sign-in, a linked account, and anything else', () => {
		expect(providerErrorMessage('access_denied')).toMatch(/cancelled/);
		expect(providerErrorMessage('account_already_linked_to_different_user')).toMatch(/another/);
		expect(providerErrorMessage('whatever')).toMatch(/failed/);
	});
});
