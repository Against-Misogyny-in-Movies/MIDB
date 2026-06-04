import { tmdbHeaders, TMDB_BASE } from '$lib/server/integrations/tmdb';
import type { SearchResult } from '$lib/components/search/types';

export type { SearchResult };

interface TmdbMultiItem {
	id: number;
	media_type: string;
	title?: string;
	name?: string;
	poster_path: string | null;
	release_date?: string;
	first_air_date?: string;
}

interface TmdbSearchResponse {
	results: TmdbMultiItem[];
}

/**
 * Searches TMDB's multi-search endpoint for movies and TV series matching `query`.
 * Filters out non-movie/tv results (people, collections) and normalises the shape.
 *
 * @param query - Non-empty search string from the user.
 * @returns Array of `SearchResult` items; empty on TMDB error or no matches.
 */
export async function search(query: string): Promise<SearchResult[]> {
	const url = new URL(`${TMDB_BASE}/3/search/multi`);
	url.searchParams.set('query', query);
	url.searchParams.set('include_adult', 'false');
	url.searchParams.set('language', 'en-US');
	url.searchParams.set('page', '1');

	const response = await fetch(url.toString(), { headers: tmdbHeaders() });

	if (!response.ok) {
		console.warn(`TMDB search failed: ${response.status} ${response.statusText}`);
		return [];
	}

	const data: TmdbSearchResponse = await response.json();
	return data.results
		.filter((item) => item.media_type === 'movie' || item.media_type === 'tv')
		.map((item) => ({
			id: item.id,
			title: item.title ?? item.name ?? '',
			posterPath: item.poster_path ?? null,
			releaseYear: (item.release_date ?? item.first_air_date ?? '').slice(0, 4),
			mediaType: item.media_type as 'movie' | 'tv'
		}));
}
