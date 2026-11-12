import type { PageServerLoad } from './$types';
import { PUBLIC_PAGE } from '#lib/server/http/cache.ts';
import { loadTitle } from '#lib/server/titles/load-title.ts';

// User-agnostic (the navbar's session comes from /api/me), so a shared CDN may serve it.
// Nothing in this load may read locals.getUser(). The policy is set after a successful load:
// Kit applies `setHeaders` to the error page and the error `__data.json` too, and a failed
// lookup must not be pinned at the edge.
export const load: PageServerLoad = async ({ params, setHeaders }) => {
	const data = await loadTitle('movie', params.movieId);
	setHeaders({ ...PUBLIC_PAGE });
	return data;
};
