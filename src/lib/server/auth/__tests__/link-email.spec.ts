import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Account } from 'better-auth';
import { adoptProviderEmail } from '../link-email.ts';
import type { AuthEndpointContext } from '../types.ts';

const findUserById = vi.fn();
const findUserByEmail = vi.fn();
const updateUser = vi.fn();
const getUserInfo = vi.fn();
const warn = vi.fn();

const ctx = {
	context: {
		options: {},
		internalAdapter: { findUserById, findUserByEmail, updateUser },
		socialProviders: [{ id: 'google', getUserInfo }],
		logger: { warn }
	}
} as unknown as AuthEndpointContext;

const account = {
	userId: 'user-1',
	providerId: 'google',
	accessToken: 'at',
	idToken: 'it'
} as Account;

beforeEach(() => {
	for (const fn of [findUserById, findUserByEmail, updateUser, getUserInfo, warn]) fn.mockReset();
	findUserById.mockResolvedValue({ id: 'user-1', email: 'user-1@users.invalid' });
	findUserByEmail.mockResolvedValue(null);
	getUserInfo.mockResolvedValue({ user: { email: 'Mary@Example.com', emailVerified: true } });
});

describe('adoptProviderEmail', () => {
	it("replaces a placeholder with the provider's verified email, lowercased", async () => {
		await adoptProviderEmail(account, ctx);
		expect(updateUser).toHaveBeenCalledWith('user-1', {
			email: 'mary@example.com',
			emailVerified: true
		});
	});

	it('leaves a real email alone and asks the provider for nothing', async () => {
		findUserById.mockResolvedValue({ id: 'user-1', email: 'mary@example.com' });
		await adoptProviderEmail(account, ctx);
		expect(getUserInfo).not.toHaveBeenCalled();
		expect(updateUser).not.toHaveBeenCalled();
	});

	it('skips an unverified provider email', async () => {
		getUserInfo.mockResolvedValue({ user: { email: 'mary@example.com', emailVerified: false } });
		await adoptProviderEmail(account, ctx);
		expect(updateUser).not.toHaveBeenCalled();
	});

	it('skips an email that belongs to another user', async () => {
		findUserByEmail.mockResolvedValue({ id: 'user-2' });
		await adoptProviderEmail(account, ctx);
		expect(updateUser).not.toHaveBeenCalled();
	});

	it('skips a provider that is not configured', async () => {
		await adoptProviderEmail({ ...account, providerId: 'discord' }, ctx);
		expect(updateUser).not.toHaveBeenCalled();
	});

	it('does nothing without an endpoint context', async () => {
		await adoptProviderEmail(account, null);
		expect(findUserById).not.toHaveBeenCalled();
	});

	it('logs and carries on when the provider fails, so the link is not aborted', async () => {
		getUserInfo.mockRejectedValue(new Error('provider down'));
		await expect(adoptProviderEmail(account, ctx)).resolves.toBeUndefined();
		expect(warn).toHaveBeenCalledOnce();
		expect(updateUser).not.toHaveBeenCalled();
	});
});
