import type { Backend } from '#lib/server/cache/backend.ts';
import { createCacheApiBackend } from '#lib/server/cache/cache-api.ts';
import { createMemoryBackend } from '#lib/server/cache/memory.ts';

/**
 * Server-side cache for upstream responses, with the fixed-window counters behind `incr`.
 *
 * On Cloudflare Workers the backend is the Cache API behind a per-isolate memory level
 * (`cache-api.ts`): isolates are short-lived, so process memory alone would lose most
 * entries. Where `caches` is missing (unit tests, plain Node) it is the memory level alone
 * (`memory.ts`). Callers use `getCached(key, ttlMs, fetcher)` either way.
 *
 * This is not the page CDN: Workers Caching serves page responses (`docs/architecture.md`,
 * Caching policy), and this store holds only what the server fetches from TMDB and DDD.
 */

// One memory level for the isolate's lifetime; the Cache API backend wraps it.
const memory = createMemoryBackend();

let cacheApi: { cache: Cache; backend: Backend } | undefined;

/** The Cache API when the runtime has one, else the memory level. Resolved per call: the dev server installs `caches` after this module loads. */
function backend(): Backend {
	const cache = (globalThis as { caches?: { default?: Cache } }).caches?.default;
	if (!cache) return memory;
	if (cacheApi?.cache !== cache)
		cacheApi = { cache, backend: createCacheApiBackend(cache, memory) };
	return cacheApi.backend;
}

/**
 * Returns the cached value for `key`, or runs `fetcher`, stores its result for `ttlMs`,
 * and returns it. On any cache-backend failure the fetcher still runs, so caching can
 * never make a request fail, only slower.
 *
 * @param key - Namespaced cache key, e.g. `tmdb:movie:603`.
 * @param ttlMs - Time-to-live in milliseconds.
 * @param fetcher - Produces the value on a cache miss.
 */
export async function getCached<T>(
	key: string,
	ttlMs: number,
	fetcher: () => Promise<T>
): Promise<T> {
	const store = backend();
	const hit = await store.get<T>(key);
	if (hit !== undefined) return hit;

	const value = await fetcher();
	await store.set(key, value, ttlMs);
	return value;
}

/**
 * Adds 1 to the fixed-window counter at `key` and returns the new count. The window
 * (`ttlMs`) starts on the first hit; afterwards the count starts over at 1.
 *
 * Counters live in this isolate's memory: each isolate counts on its own and a restart
 * resets them, so a limit built on them is best effort. Production limits use the
 * rate-limit bindings (`http/rate-limit.ts`); this is their fallback for dev and tests.
 *
 * @param key - Namespaced counter key, e.g. `rl:RL_SEARCH:ip:203.0.113.7`.
 * @param ttlMs - Window length in milliseconds.
 */
export function incr(key: string, ttlMs: number): Promise<number> {
	return backend().incr(key, ttlMs);
}

/**
 * Clears the memory level and the counters. The Cache API has no clear, so its entries live
 * until they expire. Intended for tests only.
 */
export async function clearCache(): Promise<void> {
	await memory.clear();
}
