import { error } from '@sveltejs/kit';
import { z } from 'zod';
import type { RequestHandler } from './$types';
import { profileHeaders } from '#lib/server/http/cache.ts';
import { rateLimit } from '#lib/server/http/rate-limit.ts';
import { findProfileOwner, getProfileComments } from '#lib/server/data/profile-queries.ts';

const listQuery = z.object({ cursor: z.string().max(100).nullish() });

/**
 * A further page of an account's published comments for "Load more" on its public profile:
 * `PUBLIC_PAGE` with the account's `Cache-Tag`, the same for every reader, so it never reads
 * the user and sets no cookie. Rate-limited by IP (`RL_COMMENT_READ`), since the route is open
 * to anyone. An unknown or banned account is 404.
 */
export const GET: RequestHandler = async (event) => {
	const query = listQuery.safeParse({ cursor: event.url.searchParams.get('cursor') });
	if (!query.success) error(400, 'Invalid request');
	await rateLimit(event, 'RL_COMMENT_READ');

	const owner = await findProfileOwner(event.params.username);
	if (!owner) error(404, 'Profile not found');
	const page = await getProfileComments(owner.id, query.data.cursor);
	return Response.json(page, { headers: profileHeaders(owner.id) });
};
