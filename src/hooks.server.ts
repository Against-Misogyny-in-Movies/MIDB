import { redirect, error, type Handle } from '@sveltejs/kit';
import { emailFromClaims, verifyClaims } from '$lib/server/auth/hanko';
import { getOrCreateUser } from '$lib/server/data/user-queries';

export const handle: Handle = async ({ event, resolve }) => {
	const claims = await verifyClaims(event);

	if (claims?.sub) {
		event.locals.user = await getOrCreateUser({
			sub: claims.sub,
			email: emailFromClaims(claims)
		});
	} else {
		event.locals.user = null;
	}

	if (event.url.pathname.startsWith('/user') && !event.locals.user) {
		redirect(303, '/auth');
	}

	// Authorization is always DB-sourced (locals.user.role) — Hanko has no concept of MIDB roles.
	if (event.url.pathname.startsWith('/user/moderation')) {
		const role = event.locals.user?.role;
		if (role !== 'moderator' && role !== 'administrator') {
			throw error(403, 'Forbidden');
		}
	}

	return resolve(event);
};
