import { isHttpError, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { searchTitles } from '$lib/server/integrations/tmdb';
import { PUBLIC_SEARCH } from '$lib/server/http/cache';
import { rateLimit } from '$lib/server/http/rate-limit';
import { SEARCH_QUERY_MAX_LENGTH } from '$lib/media/utils/search';

export const GET: RequestHandler = async (event) => {
	const { url } = event;
	// Over-long input is truncated, not rejected: the search inputs already stop at the cap.
	const q = (url.searchParams.get('q') ?? '').trim().slice(0, SEARCH_QUERY_MAX_LENGTH);

	if (!q) {
		return json({ results: [] });
	}

	// Per IP: the response is public and CDN-cached, so it must not depend on the user.
	// Outside the try below, so the 429 is not swallowed into an empty result.
	await rateLimit(event, 'search', 60, 60_000);

	try {
		const results = await searchTitles(q);
		return json({ results }, { headers: { 'cache-control': PUBLIC_SEARCH } });
	} catch (err) {
		// TMDB error status or network failure: answer "no results" without the public
		// cache header, so neither the CDN nor the browser holds on to the outage.
		if (isHttpError(err)) console.warn(`TMDB search failed: ${err.status} ${err.body.message}`);
		else console.warn('Search error:', err);
		return json({ results: [] });
	}
};
