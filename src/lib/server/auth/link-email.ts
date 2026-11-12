import type { Account } from 'better-auth';
import type { AuthEndpointContext } from './types.ts';
import { isPlaceholderEmail } from './placeholder-email.ts';

/**
 * `databaseHooks.account.create.after`: when a Google or Discord account is linked to a user
 * who only has the placeholder email, adopt the provider's verified email. Better Auth never
 * changes `email` on a link, so the swap is made here. It is skipped when the provider's
 * email is missing or unverified, or belongs to another user, and a failure never aborts the
 * link.
 */
export async function adoptProviderEmail(
	account: Account,
	ctx: AuthEndpointContext | null
): Promise<void> {
	if (!ctx) return;
	const { internalAdapter, socialProviders, logger } = ctx.context;
	try {
		const user = await internalAdapter.findUserById(account.userId);
		if (!user || !isPlaceholderEmail(user.email)) return;

		const provider = socialProviders.find((p) => p.id === account.providerId);
		if (!provider) return;

		const info = await provider.getUserInfo({
			tokenType: 'Bearer',
			accessToken: account.accessToken ?? undefined,
			refreshToken: account.refreshToken ?? undefined,
			idToken: account.idToken ?? undefined
		});
		const email = info?.user.email?.toLowerCase();
		if (!info || !email || !info.user.emailVerified) return;
		if (await internalAdapter.findUserByEmail(email)) return;

		await internalAdapter.updateUser(user.id, { email, emailVerified: true });
	} catch (err) {
		logger.warn('Could not adopt the provider email after linking', err);
	}
}
