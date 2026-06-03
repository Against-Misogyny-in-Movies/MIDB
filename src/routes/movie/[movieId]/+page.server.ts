import type { PageServerLoad } from './$types';
import { getMovie } from './datasource.server';
import { getOrCreateDbMovie, getBechdel, getUnconsenting } from './db.server';
import { getTriggerTagsLive } from './ddd.server';

export const load: PageServerLoad = async ({ params }) => {
	const movie = await getMovie(params.movieId);
	const dbMovie = await getOrCreateDbMovie(movie);

	const [bechdel, unconsenting] = await Promise.all([
		getBechdel(dbMovie.id),
		getUnconsenting(dbMovie.id),
	]);

	return {
		movie,
		bechdel,
		unconsenting,
		triggerTags: getTriggerTagsLive(movie.imdbId), // un-awaited: streamed
	};
};
