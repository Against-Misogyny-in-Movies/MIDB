import { isHttpError, isRedirect } from '@sveltejs/kit';
import type { Handle } from '@sveltejs/kit/hooks';
import { getSessionCookie } from 'better-auth/cookies';
import { getAuth } from '#lib/server/auth/auth.ts';
import { requireRole } from '#lib/server/auth/guards.ts';
import { asPrivate } from '#lib/server/http/cache.ts';
import { getUserById, type UserRow } from '#lib/server/data/user-queries.ts';
import { STAFF_ROLES } from '#lib/media/utils/staff.ts';

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

	return asPrivate(response);
}

const SECURITY_HEADERS = {
	'strict-transport-security': 'max-age=63072000; includeSubDomains',
	'x-content-type-options': 'nosniff',
	'referrer-policy': 'strict-origin-when-cross-origin',
	'x-frame-options': 'DENY',
	'permissions-policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
	'cross-origin-opener-policy': 'same-origin'
};

/**
 * Every response the hook returns carries the security headers (`docs/architecture.md`, Caching policy). The response is copied, because one from `fetch`, a library or `Response.redirect` has
 * immutable headers. Assets served by Workers Assets never reach the hook and do not carry them.
 */
function withSecurityHeaders(response: Response): Response {
	const out = new Response(response.body, response);
	for (const [name, value] of Object.entries(SECURITY_HEADERS)) out.headers.set(name, value);
	return out;
}

/** The one exit of `handle`: the cache policy, then the security headers. */
function finish(response: Response): Response {
	return withSecurityHeaders(withSafeCacheHeaders(response));
}

/**
 * The signed-in user, or null. The session comes from Better Auth (its cookie cache answers
 * without a query for a few minutes); the row is then read fresh, so a ban, a role change or a
 * deleted account applies on the next request, not when the cached cookie expires.
 */
async function resolveUser(request: Request): Promise<UserRow | null> {
	const session = await getAuth().api.getSession({ headers: request.headers });
	if (!session) return null;
	const user = await getUserById(session.user.id);
	return user && !user.bannedAt ? user : null;
}

export const handle: Handle = async ({ event, resolve }) => {
	// Lazy and memoised: only routes that need the user (/user/*, /api/me) touch Better Auth
	// and the DB, and at most once per request. Public pages never call it.
	let user: Promise<UserRow | null> | undefined;
	event.locals.getUser = () => (user ??= resolveUser(event.request));

	const { pathname } = event.url;

	// Returned, not thrown: a thrown redirect skips `finish`, and whether this one
	// applies depends on the cookie, which the edge cache key ignores. The gate checks only that
	// a session cookie exists; the guards verify the session itself.
	if (isAccountPath(pathname) && !getSessionCookie(event.request)) {
		return finish(new Response(null, { status: 303, headers: { location: '/auth' } }));
	}

	if (pathname.startsWith('/user/moderation')) {
		// The guard throws; a thrown redirect or error would skip `finish`.
		try {
			await requireRole(event.locals, STAFF_ROLES, { page: true });
		} catch (err) {
			if (isRedirect(err)) {
				return finish(
					new Response(null, { status: err.status, headers: { location: err.location } })
				);
			}
			if (isHttpError(err)) {
				return finish(new Response(err.body.message, { status: err.status }));
			}
			throw err;
		}
	}

	return finish(await resolve(event));
};
