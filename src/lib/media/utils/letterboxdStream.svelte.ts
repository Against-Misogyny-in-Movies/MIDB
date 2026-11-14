import type { LetterboxdOutcome } from '#lib/media/types/letterboxd.ts';
import { createStreamedState } from './streamedState.svelte.js';

/**
 * The Letterboxd rating from the sources request. `current` is undefined while the lookup runs, null when
 * Letterboxd has no rating and `'failed'` when the lookup failed or the request errored, so the
 * slot can tell loading, empty and unavailable apart.
 */
export function createLetterboxdState(getPromise: () => Promise<LetterboxdOutcome> | undefined) {
	return createStreamedState<LetterboxdOutcome, undefined>(getPromise, 'failed', undefined);
}
