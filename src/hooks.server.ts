import { redirect } from '@sveltejs/kit';
import type { Handle } from '@sveltejs/kit/hooks';
import { emailFromClaims, verifyClaims } from '#lib/server/auth/hanko.ts';
import { requireRole } from '#lib/server/auth/guards.ts';
import { getOrCreateUser, type UserRow } from '#lib/server/data/user-queries.ts';

/** `/user` and `/user/*` only: `/users…` and `/username` are not account routes. */
function isAccountPath(pathname: string): boolean {
	return pathname === '/user' || pathname.startsWith('/user/');
}

/**
 * Workers Caching stores a 200 that carries no cache header for two hours, and keys on path +
 * query with cookies ignored. So every response that did not opt into a public policy is made
 * private, and a response that sets a cookie never leaves with an edge directive.
 */
function withSafeCacheHeaders(response: Response): Response {
	const setsCookie = response.headers.has('set-cookie');
	if (!setsCookie && response.headers.has('cache-control')) return response;

	// A response from `fetch` has immutable headers; copy it before changing them.
	const safe = new Response(response.body, response);
	safe.headers.set('cache-control', 'private, no-store');
	if (setsCookie) {
		safe.headers.delete('cdn-cache-control');
		safe.headers.delete('cloudflare-cdn-cache-control');
	}
	return safe;
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

	return withSafeCacheHeaders(await resolve(event));
};
