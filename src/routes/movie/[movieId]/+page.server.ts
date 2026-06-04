import type { PageServerLoad } from './$types';
import { getMovie } from './datasource.server';
import { getDbMovie, getBechdel, getUnconsenting } from '$lib/server/data/media-queries';
import { getUnconsentingCandidates } from '$lib/server/data/um-candidates';
import { getTriggerTagsLive } from '$lib/server/integrations/ddd';

export const load: PageServerLoad = async ({ params }) => {
	const movie = await getMovie(params.movieId);
	const dbMovie = await getDbMovie(movie);

	const [bechdel, unconsenting] = dbMovie
		? await Promise.all([getBechdel(dbMovie.id), getUnconsenting(dbMovie.id)])
		: [null, null];

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
