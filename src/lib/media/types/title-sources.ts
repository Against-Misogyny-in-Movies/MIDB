import type { DddResult } from '#lib/media/types/ddd.ts';
import type { LetterboxdOutcome } from '#lib/media/types/letterboxd.ts';

/**
 * The body of `GET /api/titles/[kind]/[tmdbId]/sources`: the two live sources of a title page.
 * `ddd` is an empty result when Does the Dog Die has nothing or did not answer; `letterboxd` is
 * null for a series, without keys and for a film Letterboxd has no average for, and `'failed'`
 * when the lookup failed.
 */
export interface TitleSources {
	ddd: DddResult;
	letterboxd: LetterboxdOutcome;
}
