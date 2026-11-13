import type { LetterboxdResult } from '#lib/media/types/letterboxd.ts';

/**
 * The streamed Letterboxd rating. `current` is undefined while the lookup runs and null when
 * there is no rating (no key, an unknown film, an error), so the slot can tell loading from empty.
 */
export function createLetterboxdState(
	getPromise: () => Promise<LetterboxdResult | null> | undefined
) {
	let current = $state<LetterboxdResult | null | undefined>(undefined);

	$effect(() => {
		let cancelled = false;
		current = undefined;
		const promise = getPromise();
		if (!promise) return;
		void promise
			.catch((): null => null)
			.then((result) => {
				if (!cancelled) current = result;
			});
		return () => {
			cancelled = true;
		};
	});

	return {
		get current() {
			return current;
		}
	};
}
