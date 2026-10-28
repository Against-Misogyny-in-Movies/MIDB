import type { PageServerLoad } from './$types';
import { PUBLIC_NO_STORE } from '$lib/server/http/cache';
import { getCatalogueCounts, getRandomRatedFilms } from '$lib/server/data/catalogue';

export const load: PageServerLoad = async ({ setHeaders }) => {
	setHeaders({ 'cache-control': PUBLIC_NO_STORE });
	// Seeded data only: user-agnostic, with six random films per request, so nothing caches it.
	// The page still renders (search and sources) when the database is unreachable, without the
	// counts and the hero films.
	try {
		const [counts, films] = await Promise.all([getCatalogueCounts(), getRandomRatedFilms(6)]);
		return { counts, films };
	} catch (error) {
		console.error('landing: catalogue query failed', error);
		return { counts: null, films: [] };
	}
};
