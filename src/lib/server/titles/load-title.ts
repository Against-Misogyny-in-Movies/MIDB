import type { Movie } from '$lib/media/types/movie';
import type { Series } from '$lib/media/types/series';
import type { DddResult } from '$lib/media/types/ddd';
import type { UmEntry } from '$lib/media/types/um';
import { getMovie, getSeries } from '$lib/server/integrations/tmdb';
import { getTriggerTagsForSeries, getTriggerTagsLive } from '$lib/server/integrations/ddd';
import { getTitleRow, type TitleKind } from '$lib/server/data/title-queries';
import { getBechdel, getUmEntry, type BechdelData } from '$lib/server/data/sources';
import { getUnconsentingCandidates } from '$lib/server/data/um-candidates';

export interface TitlePageData<M extends Movie | Series> {
	media: M;
	/** Seeded BechdelTest.com rating; always null for series (the test rates films). */
	bechdel: BechdelData | null;
	/** The seeded UM binding, read through title_um → um_source. */
	umEntry: UmEntry | null;
	/** Catalogue candidates when there is no binding; the user's pick stays client-side. */
	umCandidates: UmEntry[];
	/** Un-awaited, so SvelteKit streams it after first paint. */
	triggerTags: Promise<DddResult>;
}

/**
 * The detail-page data for a movie or a series: TMDB, then the `titles` row (read-only, a page
 * visit never writes), then the seeded sources, then UM candidates when nothing is bound, plus
 * the streamed DDD lookup. User-agnostic, so `PUBLIC_PAGE` caching is safe.
 *
 * @throws SvelteKit `error()` when TMDB rejects the id.
 */
export function loadTitle(kind: 'movie', tmdbId: string): Promise<TitlePageData<Movie>>;
export function loadTitle(kind: 'tv', tmdbId: string): Promise<TitlePageData<Series>>;
export async function loadTitle(
	kind: TitleKind,
	tmdbId: string
): Promise<TitlePageData<Movie | Series>> {
	return kind === 'movie'
		? withSources('movie', await getMovie(tmdbId), (movie) => getTriggerTagsLive(movie.imdbId))
		: withSources('tv', await getSeries(tmdbId), getTriggerTagsForSeries);
}

async function withSources<M extends Movie | Series>(
	kind: TitleKind,
	media: M,
	streamTriggerTags: (media: M) => Promise<DddResult>
): Promise<TitlePageData<M>> {
	const row = await getTitleRow(kind, media);

	const [bechdel, umEntry] = row
		? await Promise.all([kind === 'movie' ? getBechdel(row.id) : null, getUmEntry(row.id)])
		: [null, null];

	// No seeded UM binding → offer catalogue candidates for the same title.
	const umCandidates = umEntry === null ? await getUnconsentingCandidates(media) : [];

	return { media, bechdel, umEntry, umCandidates, triggerTags: streamTriggerTags(media) };
}
