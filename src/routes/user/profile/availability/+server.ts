import { requireUser } from '#lib/server/auth/guards.ts';
import { rateLimit } from '#lib/server/http/rate-limit.ts';
import { isUsernameAvailable } from '#lib/server/data/user-queries.ts';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async (event) => {
	const { url, locals } = event;
	const user = await requireUser(locals);
	await rateLimit(event, 'username-availability', 30, 60_000, { userId: user.id });
	const username = url.searchParams.get('username') ?? '';
	if (!username) return Response.json({ available: false });
	const available = await isUsernameAvailable(username, user.id);
	return Response.json({ available });
};
