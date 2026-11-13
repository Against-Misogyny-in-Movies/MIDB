/** Detail-page path for a stored title; undefined when it has no TMDB id to route by. */
export function titleHref(kind: 'movie' | 'tv', tmdbId: number | null): string | undefined {
	return tmdbId === null ? undefined : `/${kind}/${tmdbId}`;
}

/** Link to one comment on its title's page; undefined when the title has no TMDB id to route by. */
export function commentHref(
	kind: 'movie' | 'tv',
	tmdbId: number | null,
	commentId: string
): string | undefined {
	const base = titleHref(kind, tmdbId);
	return base === undefined ? undefined : `${base}#comment-${commentId}`;
}
