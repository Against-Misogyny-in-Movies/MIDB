import { error } from '@sveltejs/kit';
import type { TitleKind } from '#lib/server/data/title-queries.ts';

/**
 * A kind and TMDB id from a title route's path, or a 404. The id is normalised (`0348` is `348`)
 * so a cache tag and the purge of it name the same title whatever the path's padding. The id is
 * part of the TMDB path, so one that is not 1–9 digits (`..%2F`) must never reach a request.
 */
export function parseTitleParams(
	kind: string,
	tmdbId: string
): { kind: TitleKind; tmdbId: string } {
	if ((kind !== 'movie' && kind !== 'tv') || !/^\d{1,9}$/.test(tmdbId))
		error(404, 'Title not found');
	return { kind, tmdbId: String(Number(tmdbId)) };
}
