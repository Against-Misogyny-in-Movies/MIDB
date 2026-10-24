import type { PageServerLoad } from './$types';
import { PUBLIC_PAGE } from '$lib/server/http/cache';

// Static content: exists only to make the page CDN-cacheable.
export const load: PageServerLoad = async ({ setHeaders }) => {
	setHeaders({ 'cache-control': PUBLIC_PAGE });
	return {};
};
