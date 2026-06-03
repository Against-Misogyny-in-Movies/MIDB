import { PUBLIC_TMDB_API_URL } from '$env/static/public';
import { TMDB_API_TOKEN } from '$env/static/private';
import type { SearchResult } from '$lib/components/search/types';

export type { SearchResult };

interface TmdbMovie {
	id: number;
	title: string;
	poster_path: string | null;
	release_date?: string;
}

interface TmdbSearchResponse {
	results: TmdbMovie[];
}

export async function searchMovies(query: string): Promise<SearchResult[]> {
	const url = new URL(`${PUBLIC_TMDB_API_URL}/3/search/movie`);
	url.searchParams.set('query', query);
	url.searchParams.set('include_adult', 'false');
	url.searchParams.set('language', 'en-US');
	url.searchParams.set('page', '1');

	const response = await fetch(url.toString(), {
		headers: {
			Authorization: `Bearer ${TMDB_API_TOKEN}`,
			accept: 'application/json'
		}
	});

	if (!response.ok) {
		console.warn(`TMDB search failed: ${response.status} ${response.statusText}`);
		return [];
	}

	const data: TmdbSearchResponse = await response.json();
	return data.results.map((movie) => ({
		id: movie.id,
		title: movie.title,
		posterPath: movie.poster_path ?? null,
		releaseYear: movie.release_date ? movie.release_date.slice(0, 4) : ''
	}));
}
