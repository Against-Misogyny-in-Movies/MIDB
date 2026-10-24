import { json } from '@sveltejs/kit';
import { requireUser } from '$lib/server/auth/guards';
import { isUsernameAvailable } from '$lib/server/data/user-queries';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url, locals }) => {
	const user = await requireUser(locals);
	const username = url.searchParams.get('username') ?? '';
	if (!username) return json({ available: false });
	const available = await isUsernameAvailable(username, user.id);
	return json({ available });
};
