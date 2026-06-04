import { PUBLIC_TMDB_API_URL } from '$env/static/public';
import { TMDB_API_TOKEN } from '$env/static/private';
import type { GenderBreakdown } from '$lib/media/types/media';

export const TMDB_BASE = PUBLIC_TMDB_API_URL;

/**
 * Returns the Authorization + Accept headers required by every TMDB API request.
 * The Bearer token is read from the private `TMDB_API_TOKEN` env variable at call time.
 *
 * @returns An object with `Authorization` and `accept` header fields.
 */
export function tmdbHeaders() {
	return {
		Authorization: `Bearer ${TMDB_API_TOKEN}`,
		accept: 'application/json'
	};
}

export interface TmdbCreditEntry {
	gender: number;
}

/**
 * Aggregates a TMDB credits array (cast or crew) into a gender breakdown count.
 * TMDB encodes gender as: 0 = unknown, 1 = female, 2 = male, 3 = non-binary.
 *
 * @param entries - Array of credit objects, each with a numeric `gender` field.
 * @returns A `GenderBreakdown` with counts per category and a `total`.
 */
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
