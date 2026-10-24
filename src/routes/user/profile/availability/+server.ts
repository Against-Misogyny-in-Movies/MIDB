import { json } from '@sveltejs/kit';
import { isUsernameAvailable } from '$lib/server/data/user-queries';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url, locals }) => {
	const username = url.searchParams.get('username') ?? '';
	if (!username || !locals.user) return json({ available: false });
	const available = await isUsernameAvailable(username, locals.user.id);
	return json({ available });
};
