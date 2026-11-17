import { getAuth } from './auth.ts';

/**
 * The id of the session that made the request, read from the database and not from the signed
 * cookie, or null when that session has ended or belongs to another user. A browser whose
 * session was ended elsewhere still holds a valid cookie for a few minutes
 * (`SESSION_COOKIE_CACHE_SECONDS`); it must not list or end the account's sessions.
 */
export async function currentSessionId(request: Request, userId: string): Promise<string | null> {
	const session = await getAuth().api.getSession({
		headers: request.headers,
		query: { disableCookieCache: true }
	});
	return session && session.user.id === userId ? session.session.id : null;
}
