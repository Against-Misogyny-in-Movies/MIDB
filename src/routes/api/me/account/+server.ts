import { error } from '@sveltejs/kit';
import { z } from 'zod';
import { getAuth } from '#lib/server/auth/auth.ts';
import { currentSession } from '#lib/server/auth/current-session.ts';
import { requireUser } from '#lib/server/auth/guards.ts';
import { scrubAccount } from '#lib/server/data/account-scrub.ts';
import { PRIVATE_NO_STORE } from '#lib/server/http/cache.ts';
import { privateJson, readBody } from '#lib/server/http/comment-request.ts';
import {
	purgeProfiles,
	purgeTitlesComments,
	purgeTitlesReports
} from '#lib/server/http/purge-title.ts';
import { rateLimit } from '#lib/server/http/rate-limit.ts';
import { isRecentSession, type AccountDeleteRefusal } from '#lib/media/utils/accountDeletion.ts';
import type { RequestHandler } from './$types';

const bodySchema = z.object({ username: z.string().max(100) });

const REFUSAL_STATUS: Record<AccountDeleteRefusal, number> = {
	'session-stale': 403,
	'username-mismatch': 422,
	'last-administrator': 409
};

/** `{ error: <code> }` with the refusal's status, for the settings page to put in words. */
function refuse(code: AccountDeleteRefusal): Response {
	return privateJson({ error: code }, REFUSAL_STATUS[code]);
}

/** The `Set-Cookie` headers that clear the session cookies, from Better Auth's own sign-out. */
async function signOutCookies(request: Request): Promise<string[]> {
	try {
		const { headers } = await getAuth().api.signOut({
			headers: request.headers,
			returnHeaders: true
		});
		return headers.getSetCookie();
	} catch (err) {
		// The account is already gone, so its cookies resolve to no user whether or not they clear.
		console.error('[delete-account] sign-out failed', err);
		return [];
	}
}

/**
 * Deletes the signed-in account (`scrubAccount`) and signs it out. Guards, in order: signed in
 * (401), `RL_DELETE_ACCOUNT` per user for every role (429), a JSON body `{ username }` (400),
 * the asking session read from the database (401 when it has ended) and started within
 * `DELETE_SESSION_MAX_AGE_MINUTES` (403 `session-stale`), the typed username equal to the
 * account's own (422 `username-mismatch`), and not the last administrator (409
 * `last-administrator`). A muted account may delete itself. The answer is `{ ok: true }` with
 * the cleared session cookies; the page clears the `midb_hint` cookie. Private and never
 * cached.
 */
export const DELETE: RequestHandler = async (event) => {
	const user = await requireUser(event.locals);
	await rateLimit(event, 'RL_DELETE_ACCOUNT', { userId: user.id });
	const { username } = await readBody(event.request, bodySchema);

	const session = await currentSession(event.request, user.id);
	if (!session) error(401, 'Unauthorized');
	if (!isRecentSession(session.startedAt)) return refuse('session-stale');
	if (username.trim().toLowerCase() !== (user.username ?? '').toLowerCase()) {
		return refuse('username-mismatch');
	}

	const result = await scrubAccount(user.id);
	if (!result.ok) return refuse(result.reason);

	purgeProfiles([user.id, ...result.replyAuthorIds]);
	purgeTitlesComments(result.commentTitles);
	purgeTitlesReports(result.reportTitles);

	const headers = new Headers(PRIVATE_NO_STORE);
	for (const cookie of await signOutCookies(event.request)) headers.append('set-cookie', cookie);
	return Response.json({ ok: true }, { headers });
};
