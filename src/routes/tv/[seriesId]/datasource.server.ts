import { error } from '@sveltejs/kit';
import { TMDB_BASE, tmdbHeaders, aggregateGender } from '$lib/server/tmdb';
import type { Series } from './types';

export type { Series };

export const getSeries = async (seriesId: string): Promise<Series> => {
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
};
