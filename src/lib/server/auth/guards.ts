import { error, redirect } from '@sveltejs/kit';
import type { UserRole, UserRow } from '$lib/server/data/user-queries';

type GuardOptions = {
	/** Page loads redirect to /auth; actions and endpoints answer 401. */
	page?: boolean;
};

/**
 * Resolve the signed-in user or stop the request. Call in every load, action and endpoint
 * that needs a user, instead of trusting the hook's path gate (which does not cover form
 * actions on public pages).
 */
export async function requireUser(
	locals: App.Locals,
	{ page = false }: GuardOptions = {}
): Promise<UserRow> {
	const user = await locals.getUser();
	if (user) return user;
	if (page) redirect(303, '/auth');
	error(401, 'Unauthorized');
}

/** Like `requireUser`, plus a DB-sourced role check (Hanko has no concept of MIDB roles). */
export async function requireRole(
	locals: App.Locals,
	roles: readonly UserRole[],
	options: GuardOptions = {}
): Promise<UserRow> {
	const user = await requireUser(locals, options);
	if (!roles.includes(user.role)) error(403, 'Forbidden');
	return user;
}
