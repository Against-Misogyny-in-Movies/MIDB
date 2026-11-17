import { error } from '@sveltejs/kit';
import { currentSessionId } from '#lib/server/auth/current-session.ts';
import { requireUser } from '#lib/server/auth/guards.ts';
import { endSession } from '#lib/server/data/sessions.ts';
import { PRIVATE_NO_STORE } from '#lib/server/http/cache.ts';
import { rateLimit } from '#lib/server/http/rate-limit.ts';
import { isStaff } from '#lib/media/utils/staff.ts';
import type { RequestHandler } from './$types';

/**
 * Ends one of the account's other sessions. Another account's id ends nothing, and the asking
 * session cannot end itself here (Sign out does that). 204 whether or not the session was
 * still there, so the answer tells nothing about ids that belong to other accounts.
 */
export const DELETE: RequestHandler = async (event) => {
	const user = await requireUser(event.locals);
	if (!isStaff(user.role)) await rateLimit(event, 'RL_SESSIONS', { userId: user.id });
	const currentId = await currentSessionId(event.request, user.id);
	if (!currentId) error(401, 'Unauthorized');
	if (event.params.id === currentId) error(400, 'Use Sign out to end this session');

	await endSession(user.id, event.params.id);
	return new Response(null, { status: 204, headers: PRIVATE_NO_STORE });
};
