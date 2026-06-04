import { error } from '@sveltejs/kit';
import { TMDB_BASE, tmdbHeaders, aggregateGender } from '$lib/server/integrations/tmdb';
import { getCached } from '$lib/server/cache';
import type { Series } from '$lib/media/types/series';

export type { Series } from '$lib/media/types/series';

// TMDB series metadata is near-static; cache it for a day so repeat visits skip the round-trip.
const TMDB_TTL_MS = 24 * 60 * 60 * 1000;

/**
 * Fetches full TV series details from TMDB, including credits, external ids, and seasons.
 * Also aggregates cast and crew gender breakdowns from the credits response.
 * Results are cached (see {@link getCached}) so repeat visits don't re-hit TMDB.
 *
 * @param seriesId - TMDB series id (numeric string, from the route parameter).
 * @returns A fully-shaped `Series` object with metadata, seasons, networks, and gender breakdowns.
 * @throws SvelteKit `error()` if the TMDB response is not OK.
 */
export const getSeries = (seriesId: string): Promise<Series> =>
	getCached(`tmdb:series:${seriesId}`, TMDB_TTL_MS, async () => {
		const url = new URL(`${TMDB_BASE}/3/tv/${seriesId}`);
		url.searchParams.set('append_to_response', 'credits,external_ids');
		url.searchParams.set('language', 'en-US');

		const response = await fetch(url.toString(), { headers: tmdbHeaders() });

		if (!response.ok) {
			throw error(response.status, `TMDB error: ${response.statusText}`);
		}

		const data = await response.json();

		const cast = aggregateGender(data.credits?.cast ?? []);
		const crew = aggregateGender(data.credits?.crew ?? []);

		return {
			id: String(data.id),
			title: data.name ?? '',
			imdbId: data.external_ids?.imdb_id ?? null,
			posterPath: data.poster_path ?? null,
			overview: data.overview ?? '',
			releaseDate: data.first_air_date ?? '',
			tmdbId: String(data.id),
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
			firstAirDate: data.first_air_date ?? '',
			lastAirDate: data.last_air_date ?? '',
			numberOfSeasons: data.number_of_seasons ?? 0,
			numberOfEpisodes: data.number_of_episodes ?? 0,
			episodeRunTime: data.episode_run_time ?? [],
			seasons: (data.seasons ?? []).map(
				(s: { season_number: number; episode_count: number; name: string; air_date: string }) => ({
					seasonNumber: s.season_number,
					episodeCount: s.episode_count,
					name: s.name,
					airDate: s.air_date ?? ''
				})
			),
			networks: (data.networks ?? []).map((n: { id: number; name: string }) => ({
				id: n.id,
				name: n.name
			})),
			createdBy: (data.created_by ?? []).map((c: { id: number; name: string }) => ({
				id: c.id,
				name: c.name
			}))
		};
	});
