import { isHttpError } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { searchTitles } from '#lib/server/integrations/tmdb/index.ts';
import { PUBLIC_SEARCH } from '#lib/server/http/cache.ts';
import { rateLimit } from '#lib/server/http/rate-limit.ts';
import { SEARCH_QUERY_MAX_LENGTH } from '#lib/media/utils/search.ts';

export const GET: RequestHandler = async (event) => {
	const { url } = event;
	// Over-long input is truncated, not rejected: the search inputs already stop at the cap.
	const q = (url.searchParams.get('q') ?? '').trim().slice(0, SEARCH_QUERY_MAX_LENGTH);

	if (!q) {
		return Response.json({ results: [] });
	}

	// Per IP: the response is public and CDN-cached, so it must not depend on the user.
	// Outside the try below, so the 429 is not swallowed into an empty result.
	await rateLimit(event, 'RL_SEARCH');

	try {
		const results = await searchTitles(q);
		return Response.json({ results }, { headers: PUBLIC_SEARCH });
	} catch (err) {
		// TMDB error status or network failure: answer "no results" without the public
		// cache header, so neither the CDN nor the browser holds on to the outage.
		if (isHttpError(err)) console.warn(`TMDB search failed: ${err.status} ${err.body.message}`);
		else console.warn('Search error:', err);
		return Response.json({ results: [] });
	}
};
