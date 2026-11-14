import type { DddResult } from '#lib/media/types/ddd.ts';
import { createStreamedState } from './streamedState.svelte.js';

const EMPTY_MOVIE: DddResult = { itemId: null, tags: [], isSeries: false };
const EMPTY_SERIES: DddResult = { itemId: null, tags: [], isSeries: true };

/** The DDD result from the sources request: null while it loads, an empty result when the lookup rejects. */
export function createDddState(getPromise: () => Promise<DddResult>, isSeries: boolean = false) {
	return createStreamedState<DddResult, null>(
		getPromise,
		isSeries ? EMPTY_SERIES : EMPTY_MOVIE,
		null
	);
}
