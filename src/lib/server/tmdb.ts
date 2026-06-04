import { PUBLIC_TMDB_API_URL } from '$env/static/public';
import { TMDB_API_TOKEN } from '$env/static/private';
import type { GenderBreakdown } from '$lib/movie/media';

export const TMDB_BASE = PUBLIC_TMDB_API_URL;

export function tmdbHeaders() {
	return {
		Authorization: `Bearer ${TMDB_API_TOKEN}`,
		accept: 'application/json'
	};
}

export interface TmdbCreditEntry {
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
