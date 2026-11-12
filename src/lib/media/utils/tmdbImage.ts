import { PUBLIC_TMDB_IMAGE_URL } from '$app/env/public';

/**
 * The poster widths MIDB serves (`/img/tmdb/<size>/<file>`), as TMDB names them. The image
 * route allows exactly these; `original` is left out because a 3x screen would pull a
 * multi-megabyte file for a 224px poster.
 */
export const TMDB_IMAGE_SIZES = ['w92', 'w200', 'w300', 'w400', 'w500', 'w780'] as const;

export type TmdbImageSize = (typeof TMDB_IMAGE_SIZES)[number];

/** A TMDB image file name: letters, digits, `_` and `-`, then a known extension. */
export const TMDB_IMAGE_FILE = /^[A-Za-z0-9_-]+\.(jpg|png|webp)$/;

/**
 * The URL of a TMDB image at `size`. `path` is TMDB's `poster_path` (`/abc.jpg`) or the bare
 * file name; `base` is `PUBLIC_TMDB_IMAGE_URL`, `/img/tmdb` in production.
 */
export function tmdbImageUrl(
	size: TmdbImageSize,
	path: string,
	base: string = PUBLIC_TMDB_IMAGE_URL ?? ''
): string {
	return `${base.replace(/\/+$/, '')}/${size}/${path.replace(/^\/+/, '')}`;
}
