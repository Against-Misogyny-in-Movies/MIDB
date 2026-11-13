/**
 * State for a value that streams in from a promise. `current` is `initial` while the promise is
 * pending (or absent) and `fallback` when it rejects. It starts over whenever `getPromise`
 * returns another promise, and a stale promise never overwrites a newer one. Create it in
 * component context (it uses an effect).
 */
export function createStreamedState<T, I>(
	getPromise: () => Promise<T> | undefined,
	fallback: T,
	initial: I
) {
	let current = $state<T | I>(initial);

	$effect(() => {
		let cancelled = false;
		current = initial;
		const promise = getPromise();
		if (!promise) return;
		void promise
			.catch((): T => fallback)
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
