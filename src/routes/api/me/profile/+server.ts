import { requireUser } from '#lib/server/auth/guards.ts';
import { getOwnProfile } from '#lib/server/data/own-profile.ts';
import { PRIVATE_NO_STORE } from '#lib/server/http/cache.ts';
import type { RequestHandler } from './$types';

/**
 * The owner's view of their own profile (`/u/[username]` asks for it once the client session
 * says the reader owns the page): `OwnProfile`, private and never cached. 401 when signed out.
 */
export const GET: RequestHandler = async ({ locals }) => {
	const user = await requireUser(locals);
	return Response.json(await getOwnProfile(user), { headers: PRIVATE_NO_STORE });
};
