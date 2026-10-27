import type { PageServerLoad } from './$types';
import { PUBLIC_PAGE } from '$lib/server/http/cache';
import { getCatalogueCounts, getMostVotedRatedFilms } from '$lib/server/data/catalogue';

export const load: PageServerLoad = async ({ setHeaders }) => {
	setHeaders({ 'cache-control': PUBLIC_PAGE });
	// Seeded data only: user-agnostic, and the page still renders (search and sources) when the
	// database is unreachable, without the counts and the data card.
	try {
		const [counts, films] = await Promise.all([
			getCatalogueCounts(),
			getMostVotedRatedFilms(6, { requireUmEntry: true })
		]);
		return { counts, films };
	} catch (error) {
		console.error('landing: catalogue query failed', error);
		return { counts: null, films: [] };
	}
};
