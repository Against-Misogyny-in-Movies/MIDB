import { requireUser } from '#lib/server/auth/guards.ts';
import { rateLimit } from '#lib/server/http/rate-limit.ts';
import { usernameAvailability } from '#lib/server/data/user-queries.ts';
import { isStaff } from '#lib/media/utils/staff.ts';
import type { RequestHandler } from './$types';

/**
 * Whether a username can be chosen: `available` is the answer the page reads, and `reason` says
 * which rule a refused name breaks (`taken`, `reserved`, `blocked` or `format`).
 */
export const GET: RequestHandler = async (event) => {
	const { url, locals } = event;
	const user = await requireUser(locals);
	if (!isStaff(user.role)) await rateLimit(event, 'RL_AVAILABILITY', { userId: user.id });
	const username = url.searchParams.get('username') ?? '';
	const reason = username ? await usernameAvailability(username, user.id) : 'format';
	return Response.json({ available: reason === 'available', reason });
};
