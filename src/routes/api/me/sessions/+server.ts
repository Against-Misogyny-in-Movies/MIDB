import { error } from '@sveltejs/kit';
import { currentSessionId } from '#lib/server/auth/current-session.ts';
import { requireUser } from '#lib/server/auth/guards.ts';
import { endOtherSessions, listLiveSessions } from '#lib/server/data/sessions.ts';
import { PRIVATE_NO_STORE } from '#lib/server/http/cache.ts';
import { rateLimit } from '#lib/server/http/rate-limit.ts';
import { isStaff } from '#lib/media/utils/staff.ts';
import { readUserAgent } from '#lib/media/utils/userAgent.ts';
import type { AccountSession } from '#lib/media/types/sessions.ts';
import type { RequestHandler } from './$types';

/**
 * The account's live sessions (`AccountSession[]`), the one that asked first, then the newest.
 * Private and never cached; 401 signed out, or when the asking session has ended.
 */
export const GET: RequestHandler = async (event) => {
	const user = await requireUser(event.locals);
	if (!isStaff(user.role)) await rateLimit(event, 'RL_SESSIONS', { userId: user.id });
	const currentId = await currentSessionId(event.request, user.id);
	if (!currentId) error(401, 'Unauthorized');

	const rows = await listLiveSessions(user.id);
	const list: AccountSession[] = rows.map((row) => ({
		id: row.id,
		...readUserAgent(row.userAgent),
		startedAt: row.createdAt.toISOString(),
		current: row.id === currentId
	}));
	// `Array.prototype.sort` is stable: the rest keep their newest-first order.
	list.sort((a, b) => Number(b.current) - Number(a.current));
	return Response.json(list, { headers: PRIVATE_NO_STORE });
};

/** Ends every session of the account except the one that asked. */
export const DELETE: RequestHandler = async (event) => {
	const user = await requireUser(event.locals);
	if (!isStaff(user.role)) await rateLimit(event, 'RL_SESSIONS', { userId: user.id });
	const currentId = await currentSessionId(event.request, user.id);
	if (!currentId) error(401, 'Unauthorized');

	await endOtherSessions(user.id, currentId);
	return new Response(null, { status: 204, headers: PRIVATE_NO_STORE });
};
