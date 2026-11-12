import { toPublicUser } from '#lib/server/data/user-queries.ts';
import { PRIVATE_NO_STORE } from '#lib/server/http/cache.ts';
import type { RequestHandler } from './$types';

/** The client session's source (`session.svelte.ts`): `PublicUser | null`, never cached. */
export const GET: RequestHandler = async ({ locals }) => {
	const user = await locals.getUser();
	return Response.json(user ? toPublicUser(user) : null, {
		headers: PRIVATE_NO_STORE
	});
};
