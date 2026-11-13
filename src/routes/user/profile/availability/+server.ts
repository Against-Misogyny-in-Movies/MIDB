import { requireUser } from '#lib/server/auth/guards.ts';
import { rateLimit } from '#lib/server/http/rate-limit.ts';
import { isUsernameAvailable } from '#lib/server/data/user-queries.ts';
import { isStaff } from '#lib/media/utils/staff.ts';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async (event) => {
	const { url, locals } = event;
	const user = await requireUser(locals);
	if (!isStaff(user.role)) await rateLimit(event, 'RL_AVAILABILITY', { userId: user.id });
	const username = url.searchParams.get('username') ?? '';
	if (!username) return Response.json({ available: false });
	const available = await isUsernameAvailable(username, user.id);
	return Response.json({ available });
};
