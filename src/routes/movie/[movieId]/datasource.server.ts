import { error } from '@sveltejs/kit';
import { TMDB_BASE, tmdbHeaders, aggregateGender, buildCastMembers, buildCrewDepartments } from '$lib/server/integrations/tmdb';
import { getCached } from '$lib/server/cache';
import type { Movie } from '$lib/media/types/movie';

export type { Movie } from '$lib/media/types/movie';
export type { GenderBreakdown } from '$lib/media/types/media';
export { aggregateGender } from '$lib/server/integrations/tmdb';

// TMDB movie metadata is near-static; cache it for a day so repeat visits skip the round-trip.
const TMDB_TTL_MS = 24 * 60 * 60 * 1000;

/**
 * Fetches full movie details from TMDB, including credits and external ids.
 * Also aggregates cast and crew gender breakdowns from the credits response.
 * Results are cached (see {@link getCached}) so repeat visits don't re-hit TMDB.
 *
 * @param movieId - TMDB movie id (numeric string, from the route parameter).
 * @returns A fully-shaped `Movie` object with metadata, genres, cast, and crew breakdowns.
 * @throws SvelteKit `error()` if the TMDB response is not OK.
 */
export const getMovie = (movieId: string): Promise<Movie> =>
	getCached(`tmdb:movie:v2:${movieId}`, TMDB_TTL_MS, async () => {
		const url = new URL(`${TMDB_BASE}/3/movie/${movieId}`);
		url.searchParams.set('append_to_response', 'credits,external_ids');
		url.searchParams.set('language', 'en-US');

		const response = await fetch(url.toString(), { headers: tmdbHeaders() });

		if (!response.ok) {
			throw error(response.status, `TMDB error: ${response.statusText}`);
		}

		const data = await response.json();

		const cast = aggregateGender(data.credits?.cast ?? []);
		const crew = aggregateGender(data.credits?.crew ?? []);
		const castMembers = buildCastMembers(data.credits?.cast ?? []);
		const crewDepartments = buildCrewDepartments(data.credits?.crew ?? []);

		return {
			id: String(data.id),
			title: data.title,
			imdbId: data.external_ids?.imdb_id ?? data.imdb_id ?? null,
			posterPath: data.poster_path ?? null,
			overview: data.overview ?? '',
			releaseDate: data.release_date ?? '',
			tmdbId: String(data.id),
			tagline: data.tagline ?? '',
			runtime: data.runtime ?? 0,
			budget: data.budget ?? 0,
			revenue: data.revenue ?? 0,
			genres: (data.genres ?? []).map((g: { id: number; name: string }) => ({
				id: g.id,
				name: g.name
			})),
			originCountry: data.origin_country ?? [],
			originalLanguage: data.original_language ?? '',
			spokenLanguages: (data.spoken_languages ?? []).map(
				(l: { iso_639_1: string; english_name: string }) => ({
					iso: l.iso_639_1,
					englishName: l.english_name
				})
			),
			cast,
			crew,
			castMembers,
			crewDepartments
		};
	});
