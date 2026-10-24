import type { PageServerLoad } from './$types';
import { PUBLIC_PAGE } from '$lib/server/http/cache';
import { loadTitle } from '$lib/server/titles/load-title';

// User-agnostic (the navbar's session comes from /api/me), so a shared CDN may serve it.
// Nothing in this load may read locals.getUser().
export const load: PageServerLoad = ({ params, setHeaders }) => {
	setHeaders({ 'cache-control': PUBLIC_PAGE });
	return loadTitle('tv', params.seriesId);
};
