import { APIError, createAuthMiddleware, getAuthoritativeSessionFromCtx } from 'better-auth/api';
import type { AuthEndpointContext } from './types.ts';

/** Better Auth's endpoints that remove a sign-in method. */
const REMOVING_PATHS = new Set(['/unlink-account', '/passkey/delete-passkey']);

export const LAST_METHOD_MESSAGE =
	'This is the only way to sign in to the account. Add another before removing it.';

/**
 * Throws BAD_REQUEST when the user has at most one sign-in method left (a linked account or a
 * passkey), so removing one would lock them out. Better Auth's own guard counts accounts only,
 * and `deletePasskey` has none, so `allowUnlinkingAll` is set and this check replaces it.
 */
export async function assertAnotherMethodRemains(
	ctx: Pick<AuthEndpointContext, 'context'>,
	userId: string
): Promise<void> {
	const { internalAdapter, adapter } = ctx.context;
	const linked = await internalAdapter.findAccounts(userId);
	const passkeys = await adapter.findMany({
		model: 'passkey',
		where: [{ field: 'userId', value: userId }]
	});
	if (linked.length + passkeys.length <= 1) {
		throw new APIError('BAD_REQUEST', { message: LAST_METHOD_MESSAGE });
	}
}

/**
 * `hooks.before`: runs `assertAnotherMethodRemains` ahead of the endpoints that remove a
 * method. The session is read from the database, not the cookie cache. The check and the
 * delete are not one transaction, so two simultaneous removals can both pass; the orphan
 * cleanup does not cover that, but a user can only strand their own account this way.
 */
export const guardLastMethod = createAuthMiddleware(async (ctx) => {
	if (!REMOVING_PATHS.has(ctx.path)) return;
	const session = await getAuthoritativeSessionFromCtx(ctx);
	if (!session) return;
	await assertAnotherMethodRemains(ctx, session.user.id);
});
