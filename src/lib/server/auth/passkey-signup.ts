import type { AuthEndpointContext } from './types.ts';
import { placeholderEmail } from './placeholder-email.ts';

/** The name the authenticator lists the passkey under; the account's public name is its generated username. */
const NEW_ACCOUNT_NAME = 'MIDB account';

type RegistrationUser = { id: string; name: string; displayName?: string };

/**
 * `passkey({ registration: { resolveUser } })`: the user a passkey-first sign-up registers
 * for. Nothing is stored yet: the account is created in `createPasskeyUser` once the
 * authenticator's response verifies. The id is fresh, so a repeated sign-up never collides.
 */
export function resolveNewPasskeyUser(): RegistrationUser {
	const id = crypto.randomUUID();
	return { id, name: NEW_ACCOUNT_NAME, displayName: NEW_ACCOUNT_NAME };
}

/**
 * `passkey({ registration: { afterVerification } })`: creates the account a verified
 * passkey-first sign-up belongs to, with the id the registration resolved, the placeholder
 * email and an unverified address, and returns it for the passkey to attach to. When the user
 * already exists (a signed-in user adding a passkey) nothing is created and the passkey stays
 * theirs.
 */
export async function createPasskeyUser(
	ctx: Pick<AuthEndpointContext, 'context'>,
	user: RegistrationUser
): Promise<{ userId: string }> {
	const { internalAdapter } = ctx.context;
	const existing = await internalAdapter.findUserById(user.id);
	if (existing) return { userId: existing.id };

	const created = await internalAdapter.createUser(
		{ id: user.id, name: user.name, email: placeholderEmail(user.id), emailVerified: false },
		{ method: 'passkey' }
	);
	return { userId: created.id };
}
