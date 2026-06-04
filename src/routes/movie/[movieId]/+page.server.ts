import type { PageServerLoad } from './$types';
import { getMovie } from './datasource.server';
import { getOrCreateDbMovie, getBechdel, getUnconsenting, getUnconsentingCandidates } from './db.server';
import { getTriggerTagsLive } from './ddd.server';

export const load: PageServerLoad = async ({ params }) => {
	const movie = await getMovie(params.movieId);
	const dbMovie = await getOrCreateDbMovie(movie);

	const [bechdel, unconsenting] = await Promise.all([
		getBechdel(dbMovie.id),
		getUnconsenting(dbMovie.id),
	]);

	// No seeded UM binding → offer catalogue candidates for the same title.
	// The user's pick renders client-side only; we persist nothing.
	const umCandidates = unconsenting === null ? await getUnconsentingCandidates(movie) : [];

	return {
		movie,
		bechdel,
		unconsenting,
		umCandidates,
		triggerTags: getTriggerTagsLive(movie.imdbId), // un-awaited: streamed
	};
};
