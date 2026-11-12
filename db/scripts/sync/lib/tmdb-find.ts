import { fetchSource, type FetchOptions } from './http.ts';

const TMDB_BASE = process.env.PUBLIC_TMDB_API_URL || 'https://api.themoviedb.org';
const FIND_TIMEOUT_MS = 30_000;

/**
 * TMDB's id for a film, or null when TMDB has no film with that IMDb id. Only an OK answer
 * without a film counts as not found: an auth failure, a 5xx or a network error throws, so
 * the step fails instead of reporting every film as unknown.
 */
export async function resolveTmdbId(
	imdbId: string,
	token: string,
	options: Pick<FetchOptions, 'fetchImpl' | 'retryDelayMs'> = {}
): Promise<number | null> {
	const url = `${TMDB_BASE}/3/find/${imdbId}?external_source=imdb_id`;
	const res = await fetchSource(url, {
		...options,
		timeoutMs: FIND_TIMEOUT_MS,
		headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' }
	});
	const data = (await res!.json()) as { movie_results?: unknown } | null;
	if (!Array.isArray(data?.movie_results)) {
		throw new Error(`TMDB's /find answer for ${imdbId} has no movie_results.`);
	}
	const first = data.movie_results[0] as { id?: unknown } | undefined;
	return typeof first?.id === 'number' ? first.id : null;
}
