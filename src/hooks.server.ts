import { redirect, type Handle } from '@sveltejs/kit';
import { emailFromClaims, verifyClaims } from '$lib/server/auth/hanko';
import { requireRole } from '$lib/server/auth/guards';
import { getOrCreateUser, type UserRow } from '$lib/server/data/user-queries';

/** `/user` and `/user/*` only: `/users…` and `/username` are not account routes. */
function isAccountPath(pathname: string): boolean {
	return pathname === '/user' || pathname.startsWith('/user/');
}

export const handle: Handle = async ({ event, resolve }) => {
	// Local crypto against the cached JWKS: no DB.
	const claims = await verifyClaims(event);
	event.locals.claims = claims;

	// Lazy and memoised: only routes that need the user (/user/*, /api/me) touch the DB,
	// and at most once per request.
	let user: Promise<UserRow | null> | undefined;
	event.locals.getUser = () =>
		(user ??= claims?.sub
			? getOrCreateUser({ sub: claims.sub, email: emailFromClaims(claims) })
			: Promise.resolve(null));

	const { pathname } = event.url;

	if (isAccountPath(pathname) && !claims?.sub) {
		redirect(303, '/auth');
	}

	if (pathname.startsWith('/user/moderation')) {
		await requireRole(event.locals, ['moderator', 'administrator'], { page: true });
	}

	return resolve(event);
};
