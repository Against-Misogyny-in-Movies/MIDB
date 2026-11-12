import { error } from '@sveltejs/kit';
import { getMovie, getSeries } from '#lib/server/integrations/tmdb/index.ts';
import {
	getOrCreateTitleRow,
	getTitleRow,
	type TitleKind,
	type TitleRef,
	type TitleRow
} from './title-queries.ts';

/** A kind and TMDB id from a comment route's path, or a 404. */
export function parseTitleParams(
	kind: string,
	tmdbId: string
): { kind: TitleKind; tmdbId: string } {
	if ((kind !== 'movie' && kind !== 'tv') || !/^\d{1,9}$/.test(tmdbId))
		error(404, 'Title not found');
	return { kind, tmdbId };
}

/** The minimal reference `getTitleRow` needs to match on the TMDB id. */
const tmdbRef = (tmdbId: string) => ({ title: '', imdbId: null, tmdbId, releaseDate: '' });

/** Read-only: the title's row, or null when nothing was ever written for it. */
export function findCommentTitle(kind: TitleKind, tmdbId: string): Promise<TitleRow | null> {
	return getTitleRow(kind, tmdbRef(tmdbId));
}

/**
 * The write path's title: the existing row, or, for the first comment on a title, the row made
 * from TMDB's data (`getOrCreateTitleRow`). An id TMDB does not know is a 404 from the client.
 */
export async function resolveCommentTitle(kind: TitleKind, tmdbId: string): Promise<TitleRow> {
	const existing = await findCommentTitle(kind, tmdbId);
	if (existing) return existing;
	const media = kind === 'movie' ? await getMovie(tmdbId) : await getSeries(tmdbId);
	return getOrCreateTitleRow(kind, media);
}

/**
 * The write path's title reference, for a write that makes the row itself (`upsertReport`): the
 * existing row's identity, or TMDB's data for a title nothing was written for. It creates
 * nothing, so a write refused afterwards leaves no row behind. An id TMDB does not know is a 404
 * from the client.
 */
export async function resolveWriteRef(kind: TitleKind, tmdbId: string): Promise<TitleRef> {
	const existing = await findCommentTitle(kind, tmdbId);
	if (existing) return { title: existing.title, imdbId: existing.imdbId, tmdbId, releaseDate: '' };
	return kind === 'movie' ? getMovie(tmdbId) : getSeries(tmdbId);
}
