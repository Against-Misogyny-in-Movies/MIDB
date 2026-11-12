import type { PageServerLoad } from './$types';
import { PUBLIC_PAGE } from '#lib/server/http/cache.ts';

// Static content: exists only to make the page CDN-cacheable.
export const load: PageServerLoad = async ({ setHeaders }) => {
	setHeaders({ ...PUBLIC_PAGE });
	return {};
};
