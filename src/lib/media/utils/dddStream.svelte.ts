import type { DddResult } from '$lib/media/types/ddd';

const EMPTY_MOVIE: DddResult = { itemId: null, tags: [], isSeries: false };
const EMPTY_SERIES: DddResult = { itemId: null, tags: [], isSeries: true };

export function createDddState(
	getPromise: () => Promise<DddResult>,
	isSeries: boolean = false
) {
	let current = $state<DddResult | null>(null);

	$effect(() => {
		let cancelled = false;
		current = null;
		getPromise()
			.catch((): DddResult => (isSeries ? EMPTY_SERIES : EMPTY_MOVIE))
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
