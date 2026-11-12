/** A store behind `getCached` and `incr` (`cache/index.ts`). */
export interface Backend {
	get<T>(key: string): Promise<T | undefined>;
	set<T>(key: string, value: T, ttlMs: number): Promise<void>;
	/**
	 * Adds 1 to the counter at `key` and returns the new count. The first hit starts a
	 * `ttlMs` window; the counter starts over once it ends.
	 */
	incr(key: string, ttlMs: number): Promise<number>;
	/** Clears all entries. Exposed for tests. */
	clear(): Promise<void> | void;
}
