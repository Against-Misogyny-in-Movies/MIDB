import type { Movie } from '$lib/media/types/movie';
import type { Series } from '$lib/media/types/series';
import type { SearchResult } from '$lib/components/search/types';
import { getCached } from '$lib/server/cache';
import { TMDB_SEARCH_TTL_MS, tmdbCached, tmdbFetch } from './client';
import {
	mapMovie,
	mapSearchResults,
	mapSeries,
	type TmdbMovieResponse,
	type TmdbSearchResponse,
	type TmdbSeriesResponse
} from './mappers';

const DETAIL_PARAMS = { append_to_response: 'credits,external_ids', language: 'en-US' };

/**
 * Full movie details from TMDB (credits and external ids appended), mapped to `Movie`.
 * Cached for a day per id.
 *
 * @param movieId - TMDB movie id (numeric string, from the route parameter).
 * @throws SvelteKit `error()` if the TMDB response is not OK.
 */
export const getMovie = (movieId: string): Promise<Movie> =>
	tmdbCached(`tmdb:movie:v2:${movieId}`, async () =>
		mapMovie(await tmdbFetch<TmdbMovieResponse>(`/3/movie/${movieId}`, DETAIL_PARAMS))
	);

/**
 * Full TV series details from TMDB (credits and external ids appended), mapped to `Series`.
 * Cached for a day per id.
 *
 * @param seriesId - TMDB series id (numeric string, from the route parameter).
 * @throws SvelteKit `error()` if the TMDB response is not OK.
 */
export const getSeries = (seriesId: string): Promise<Series> =>
	tmdbCached(`tmdb:series:v2:${seriesId}`, async () =>
		mapSeries(await tmdbFetch<TmdbSeriesResponse>(`/3/tv/${seriesId}`, DETAIL_PARAMS))
	);

/**
 * TMDB multi-search for movies and TV series matching `query` (people and collections dropped).
 * Cached for 10 minutes per case-insensitive query (`tmdb:search:v1:<lowercased query>`).
 *
 * Only a successful response is cached. A TMDB error status throws (SvelteKit `HttpError`)
 * out of the fetcher, so `getCached` stores nothing and the next search retries; the caller
 * answers it with an uncached empty list (see `/api/search`).
 *
 * @param query - Non-empty, trimmed search string from the user.
 * @throws SvelteKit `error()` if the TMDB response is not OK.
 */
export const searchTitles = (query: string): Promise<SearchResult[]> =>
	getCached(`tmdb:search:v1:${query.toLowerCase()}`, TMDB_SEARCH_TTL_MS, async () =>
		mapSearchResults(
			await tmdbFetch<TmdbSearchResponse>('/3/search/multi', {
				query,
				include_adult: 'false',
				language: 'en-US',
				page: '1'
			})
		)
	);
