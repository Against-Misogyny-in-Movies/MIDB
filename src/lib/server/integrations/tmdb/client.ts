import { error } from '@sveltejs/kit';
import { PUBLIC_TMDB_API_URL } from '$env/static/public';
import { TMDB_API_TOKEN } from '$env/static/private';
import { getCached } from '$lib/server/cache';

// TMDB title metadata is near-static; cache it for a day so repeat visits skip the round-trip.
export const TMDB_TTL_MS = 24 * 60 * 60 * 1000;

/**
 * GETs a TMDB v3 path (e.g. `/3/movie/603`) with the bearer token and `params` as the query.
 *
 * @returns The parsed JSON body.
 * @throws SvelteKit `error(status)` if the TMDB response is not OK.
 */
export async function tmdbFetch<T>(path: string, params: Record<string, string> = {}): Promise<T> {
	const url = new URL(`${PUBLIC_TMDB_API_URL}${path}`);
	for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);

	const response = await fetch(url.toString(), {
		headers: { Authorization: `Bearer ${TMDB_API_TOKEN}`, accept: 'application/json' }
	});
	if (!response.ok) {
		throw error(response.status, `TMDB error: ${response.statusText}`);
	}
	return response.json() as Promise<T>;
}

/** `getCached` with the TMDB TTL. Keys are versioned (`tmdb:<kind>:v2:<id>`); bump on a shape change. */
export function tmdbCached<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
	return getCached(key, TMDB_TTL_MS, fetcher);
}
