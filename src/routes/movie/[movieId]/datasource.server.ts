import { PUBLIC_TMDB_API_URL } from '$env/static/public';
import { TMDB_API_TOKEN } from '$env/static/private';
import { error } from '@sveltejs/kit';
import type { GenderBreakdown, Movie } from './types';

export type { Movie, GenderBreakdown };

interface TmdbCreditEntry {
  gender: number;
}

export function aggregateGender(entries: TmdbCreditEntry[]): GenderBreakdown {
  const breakdown: GenderBreakdown = { unknown: 0, female: 0, male: 0, nonBinary: 0, total: 0 };
  for (const entry of entries) {
    breakdown.total++;
    if (entry.gender === 1) breakdown.female++;
    else if (entry.gender === 2) breakdown.male++;
    else if (entry.gender === 3) breakdown.nonBinary++;
    else breakdown.unknown++;
  }
  return breakdown;
}

export const getMovie = async (movieId: string): Promise<Movie> => {
  const url = new URL(`${PUBLIC_TMDB_API_URL}/3/movie/${movieId}`);
  url.searchParams.set('append_to_response', 'credits');
  url.searchParams.set('language', 'en-US');

  const response = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${TMDB_API_TOKEN}`,
      accept: 'application/json'
    }
  });

  if (!response.ok) {
    throw error(response.status, `TMDB error: ${response.statusText}`);
  }

  const data = await response.json();

  const cast = aggregateGender(data.credits?.cast ?? []);
  const crew = aggregateGender(data.credits?.crew ?? []);

  return {
    id: String(data.id),
    title: data.title,
    posterPath: data.poster_path ?? null,
    overview: data.overview ?? '',
    releaseDate: data.release_date ?? '',
    tmdbId: String(data.id),
    tagline: data.tagline ?? '',
    runtime: data.runtime ?? 0,
    budget: data.budget ?? 0,
    revenue: data.revenue ?? 0,
    genres: (data.genres ?? []).map((g: { id: number; name: string }) => ({ id: g.id, name: g.name })),
    originCountry: data.origin_country ?? [],
    originalLanguage: data.original_language ?? '',
    spokenLanguages: (data.spoken_languages ?? []).map((l: { iso_639_1: string; english_name: string }) => ({
      iso: l.iso_639_1,
      englishName: l.english_name
    })),
    cast,
    crew
  };
};
