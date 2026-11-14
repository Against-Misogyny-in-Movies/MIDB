import { isHttpError } from '@sveltejs/kit';
import type { TitleSources } from '#lib/media/types/title-sources.ts';
import { getMovie, getSeries } from '#lib/server/integrations/tmdb/index.ts';
import {
	getTriggerTagsForSeries,
	getTriggerTagsLive,
	type DddLookup
} from '#lib/server/integrations/ddd.ts';
import { getLetterboxdRating } from '#lib/server/integrations/letterboxd.ts';
import type { TitleKind } from '#lib/server/data/title-queries.ts';

/**
 * The live sources of a title: Does the Dog Die for a film (by the IMDb id TMDB gives) or a series
 * (by title and TMDB id), and for a film also Letterboxd. `complete` is false when a source did
 * not answer, so the caller does not let a shared cache keep an outage.
 *
 * Nothing here reads the user. A TMDB error status other than 404 counts as Does the Dog Die not
 * answering, as its stream did on the page; the Letterboxd rating needs only the TMDB id.
 *
 * @throws SvelteKit `error(404)` when TMDB does not know the id.
 */
export async function loadTitleSources(
	kind: TitleKind,
	tmdbId: string
): Promise<{ sources: TitleSources; complete: boolean }> {
	const letterboxd =
		kind === 'movie' ? getLetterboxdRating(tmdbId).catch((): 'failed' => 'failed') : null;
	const lookup = await dddLookup(kind, tmdbId);
	const outcome = await letterboxd;
	return {
		sources: { ddd: lookup.result, letterboxd: outcome },
		complete: !lookup.failed && outcome !== 'failed'
	};
}

async function dddLookup(kind: TitleKind, tmdbId: string): Promise<DddLookup> {
	try {
		return kind === 'movie'
			? await getTriggerTagsLive((await getMovie(tmdbId)).imdbId)
			: await getTriggerTagsForSeries(await getSeries(tmdbId));
	} catch (err) {
		if (isHttpError(err) && err.status === 404) throw err;
		return { result: { itemId: null, tags: [], isSeries: kind === 'tv' }, failed: true };
	}
}
