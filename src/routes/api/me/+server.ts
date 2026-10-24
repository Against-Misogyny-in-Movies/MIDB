import { json } from '@sveltejs/kit';
import { toPublicUser } from '$lib/server/data/user-queries';
import { PRIVATE_NO_STORE } from '$lib/server/http/cache';
import type { RequestHandler } from './$types';

/** The client session's source (`session.svelte.ts`): `PublicUser | null`, never cached. */
export const GET: RequestHandler = async ({ locals }) => {
	const user = await locals.getUser();
	return json(user ? toPublicUser(user) : null, {
		headers: { 'cache-control': PRIVATE_NO_STORE }
	});
};
