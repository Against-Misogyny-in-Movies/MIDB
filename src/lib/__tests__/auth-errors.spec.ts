import { describe, it, expect } from 'vitest';
import {
	LAST_METHOD_CODE,
	methodErrorMessage,
	passkeyErrorMessage,
	providerErrorMessage
} from '#lib/auth-errors.ts';

describe('passkeyErrorMessage', () => {
	it('names a rate limit', () => {
		expect(passkeyErrorMessage({ status: 429 }, 'sign-in')).toMatch(/Too many attempts/);
	});

	it('names a ban', () => {
		expect(
			passkeyErrorMessage({ status: 403, message: 'This account is banned.' }, 'sign-in')
		).toBe('This account is banned.');
	});

	it('names a failed Turnstile check on a sign-up only', () => {
		expect(
			passkeyErrorMessage(
				{ status: 403, code: 'VERIFICATION_FAILED', message: 'Captcha verification failed' },
				'sign-up'
			)
		).toMatch(/automated sign-ups/);
		expect(
			passkeyErrorMessage(
				{ status: 400, code: 'MISSING_RESPONSE', message: 'Missing CAPTCHA response' },
				'sign-up'
			)
		).toMatch(/automated sign-ups/);
	});

	it('does not blame the bot check for a 403 that is not one', () => {
		const originFailure = { status: 403, code: 'INVALID_ORIGIN', message: 'Invalid origin' };
		expect(passkeyErrorMessage(originFailure, 'sign-in')).toMatch(/could not be verified/);
		expect(passkeyErrorMessage(originFailure, 'sign-up')).toMatch(/could not be created/);
		expect(
			passkeyErrorMessage({ status: 403, code: 'VERIFICATION_FAILED' }, 'sign-in')
		).not.toMatch(/automated/);
	});

	it('names a duplicate passkey by where it was added', () => {
		const duplicate = { code: 'ERROR_AUTHENTICATOR_PREVIOUSLY_REGISTERED' };
		expect(passkeyErrorMessage(duplicate, 'add-passkey')).toBe(
			'This passkey is already on this account.'
		);
		expect(passkeyErrorMessage(duplicate, 'sign-up')).toMatch(/already registered/);
	});

	it('names a dismissed prompt', () => {
		expect(passkeyErrorMessage({ code: 'AUTH_CANCELLED' }, 'sign-in')).toMatch(/cancelled/);
		expect(passkeyErrorMessage({ code: 'ERROR_CEREMONY_ABORTED' }, 'sign-up')).toMatch(/cancelled/);
	});

	it('maps the passthrough code of a NotAllowedError to the cancelled message', () => {
		const withCause = {
			code: 'ERROR_PASSTHROUGH_SEE_CAUSE_PROPERTY',
			message: 'Something',
			cause: { name: 'NotAllowedError' }
		};
		expect(passkeyErrorMessage(withCause, 'sign-in')).toMatch(/cancelled/);
		expect(passkeyErrorMessage(withCause, 'sign-up')).toMatch(/cancelled/);

		// Better Auth's client drops the cause, so the browser's message is read instead.
		const messageOnly = {
			code: 'ERROR_PASSTHROUGH_SEE_CAUSE_PROPERTY',
			message: 'The operation either timed out or was not allowed.'
		};
		expect(passkeyErrorMessage(messageOnly, 'sign-up')).toMatch(/cancelled/);
	});

	it('leaves another passthrough error to the fallback', () => {
		expect(
			passkeyErrorMessage(
				{ code: 'ERROR_PASSTHROUGH_SEE_CAUSE_PROPERTY', message: 'Unknown', cause: { name: 'X' } },
				'sign-in'
			)
		).toMatch(/could not be verified/);
	});

	it('falls back per action', () => {
		expect(passkeyErrorMessage({}, 'sign-in')).toMatch(/could not be verified/);
		expect(passkeyErrorMessage({ status: 500 }, 'sign-up')).toMatch(/could not be created/);
		expect(passkeyErrorMessage({}, 'add-passkey')).toMatch(/could not be added/);
	});
});

describe('methodErrorMessage', () => {
	it('names a rate limit and a dead session', () => {
		expect(methodErrorMessage({ status: 429 }, 'x')).toMatch(/Too many attempts/);
		expect(methodErrorMessage({ status: 401 }, 'x')).toMatch(/session has ended/);
	});

	it("shows the server's sentence for the last method, and the fallback otherwise", () => {
		expect(methodErrorMessage({ code: LAST_METHOD_CODE, message: 'Add another first.' }, 'x')).toBe(
			'Add another first.'
		);
		expect(methodErrorMessage({ status: 400, message: 'Validation failed' }, 'fallback')).toBe(
			'fallback'
		);
	});
});

describe('providerErrorMessage', () => {
	it('maps a cancelled sign-in, a linked account, and anything else', () => {
		expect(providerErrorMessage('access_denied')).toMatch(/cancelled/);
		expect(providerErrorMessage('account_already_linked_to_different_user')).toMatch(/another/);
		expect(providerErrorMessage('whatever')).toMatch(/failed/);
	});
});
