/** Detail-page path for a stored title; undefined when it has no TMDB id to route by. */
export function titleHref(kind: 'movie' | 'tv', tmdbId: number | null): string | undefined {
	return tmdbId === null ? undefined : `/${kind}/${tmdbId}`;
}
