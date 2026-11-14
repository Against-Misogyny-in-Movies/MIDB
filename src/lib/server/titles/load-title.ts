import type { Movie } from '#lib/media/types/movie.ts';
import type { Series } from '#lib/media/types/series.ts';
import type { UmEntry } from '#lib/media/types/um.ts';
import { getMovie, getSeries } from '#lib/server/integrations/tmdb/index.ts';
import { letterboxdConfigured } from '#lib/server/integrations/letterboxd.ts';
import { parseTitleParams } from '#lib/server/titles/title-params.ts';
import { getTitleRow, type TitleKind } from '#lib/server/data/title-queries.ts';
import { getBechdel, getUmEntry, type BechdelData } from '#lib/server/data/sources.ts';
import { getUnconsentingCandidates } from '#lib/server/data/um-candidates.ts';
import { getSourceSyncDates } from '#lib/server/data/source-sync.ts';
import type { SourceSyncDates } from '#lib/media/types/source-sync.ts';

export interface TitlePageData<M extends Movie | Series> {
	media: M;
	/** Seeded BechdelTest.com rating; always null for series (the test rates films). */
	bechdel: BechdelData | null;
	/** The seeded UM binding, read through title_um → um_source. */
	umEntry: UmEntry | null;
	/** Catalogue candidates when there is no binding; the user's pick stays client-side. */
	umCandidates: UmEntry[];
	/** When the daily sync last succeeded per source; shown beside each "Source:" link. */
	syncedAt: SourceSyncDates;
	/** Both Letterboxd keys are set and the title is a film: the page renders the slot, filled from the sources endpoint. */
	letterboxdEnabled: boolean;
}

/**
 * The detail-page data for a movie or a series: TMDB, then the `titles` row (read-only, a page
 * visit never writes), then the seeded sources, then UM candidates when nothing is bound.
 * Does the Dog Die and Letterboxd are not here: the page fetches them after it loads
 * (`GET /api/titles/[kind]/[tmdbId]/sources`). User-agnostic, so `PUBLIC_PAGE` caching is safe.
 *
 * @throws SvelteKit `error()` 404 for an id that is not 1–9 digits, before any request goes out
 * (the id is part of the TMDB path, so `..%2F` would otherwise reach another endpoint), and
 * when TMDB rejects the id.
 */
export function loadTitle(kind: 'movie', tmdbId: string): Promise<TitlePageData<Movie>>;
export function loadTitle(kind: 'tv', tmdbId: string): Promise<TitlePageData<Series>>;
export async function loadTitle(
	kind: TitleKind,
	tmdbId: string
): Promise<TitlePageData<Movie | Series>> {
	const { tmdbId: id } = parseTitleParams(kind, tmdbId);
	return kind === 'movie'
		? withSources('movie', await getMovie(id))
		: withSources('tv', await getSeries(id));
}

async function withSources<M extends Movie | Series>(
	kind: TitleKind,
	media: M
): Promise<TitlePageData<M>> {
	const row = await getTitleRow(kind, media);

	const [[bechdel, umEntry], syncedAt] = await Promise.all([
		row
			? Promise.all([kind === 'movie' ? getBechdel(row.id) : null, getUmEntry(row.id)])
			: [null, null],
		getSourceSyncDates()
	]);

	// No seeded UM binding → offer catalogue candidates for the same title.
	const umCandidates = umEntry === null ? await getUnconsentingCandidates(media) : [];

	const isFilm = kind === 'movie';
	return {
		media,
		bechdel,
		umEntry,
		umCandidates,
		syncedAt,
		letterboxdEnabled: isFilm && letterboxdConfigured()
	};
}
