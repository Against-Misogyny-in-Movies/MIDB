/**
 * Fetches the async result of a query typed into a field, debounced and cancellable.
 *
 * `push(query)` restarts the debounce window. When it elapses, `source(query, signal)` runs
 * and `onResult` gets its value. A newer `push` (or `cancel`) aborts the pending timer and
 * the in-flight request through its `AbortSignal`, and drops its result if it still resolves,
 * so a stale response never overwrites a newer one. A blank query delivers `empty` at once,
 * with no request. A rejected `source` also delivers `empty`, so the field never stays stuck
 * waiting.
 *
 * Plain timer + `AbortController` (replaces the RxJS `switchMap` store, which could not
 * cancel the `fetch` itself). Nothing runs until the first `push`, so mounting costs nothing.
 */
export class DebouncedQuery<T> {
	readonly #source: (query: string, signal: AbortSignal) => Promise<T>;
	readonly #onResult: (value: T) => void;
	readonly #empty: T;
	readonly #delayMs: number;
	#timer: ReturnType<typeof setTimeout> | undefined;
	#controller: AbortController | null = null;

	/**
	 * @param source - Runs the query; should pass `signal` to `fetch`.
	 * @param onResult - Receives the value of the latest query only.
	 * @param options.empty - Delivered for a blank query or a failed `source`.
	 * @param options.delayMs - Debounce window in milliseconds (default 500).
	 */
	constructor(
		source: (query: string, signal: AbortSignal) => Promise<T>,
		onResult: (value: T) => void,
		{ empty, delayMs = 500 }: { empty: T; delayMs?: number }
	) {
		this.#source = source;
		this.#onResult = onResult;
		this.#empty = empty;
		this.#delayMs = delayMs;
	}

	/** Schedules `query`, superseding any pending or in-flight one. */
	push(query: string) {
		this.cancel();
		if (!query.trim()) {
			this.#onResult(this.#empty);
			return;
		}
		this.#timer = setTimeout(() => void this.#run(query), this.#delayMs);
	}

	/** Drops the pending query and aborts the in-flight request, delivering nothing. */
	cancel() {
		clearTimeout(this.#timer);
		this.#timer = undefined;
		this.#controller?.abort();
		this.#controller = null;
	}

	async #run(query: string) {
		this.#timer = undefined;
		const controller = new AbortController();
		this.#controller = controller;
		let value: T;
		try {
			value = await this.#source(query, controller.signal);
		} catch {
			value = this.#empty;
		}
		// Superseded while in flight: a newer query owns the result now.
		if (controller.signal.aborted) return;
		this.#controller = null;
		this.#onResult(value);
	}
}
