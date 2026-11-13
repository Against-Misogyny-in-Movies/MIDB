import type { LetterboxdOutcome } from '#lib/media/types/letterboxd.ts';
import { createStreamedState } from './streamedState.svelte.js';

/**
 * The streamed Letterboxd rating. `current` is undefined while the lookup runs, null when
 * Letterboxd has no rating and `'failed'` when the lookup failed or the stream errored, so the
 * slot can tell loading, empty and unavailable apart.
 */
export function createLetterboxdState(getPromise: () => Promise<LetterboxdOutcome> | undefined) {
	return createStreamedState<LetterboxdOutcome, undefined>(getPromise, 'failed', undefined);
}
