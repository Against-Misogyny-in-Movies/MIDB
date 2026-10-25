import { env } from '$env/dynamic/private';

/**
 * Server-side response cache with a swappable backend.
 *
 * Default backend is an in-process LRU (bounded, TTL'd) — sufficient on a long-lived
 * Node server where the process persists between requests. Set `REDIS_URL` to switch to
 * a shared Redis backend instead, which survives restarts and is shared across instances
 * (needed when scaling horizontally, or on serverless where in-process memory is ephemeral).
 *
 * Callers use a single `getCached(key, ttlMs, fetcher)` entry point regardless of backend,
 * so choosing Redis is a deploy decision (one env var), not a code change. The same backend
 * holds the fixed-window counters behind `incr(key, ttlMs)` (rate limiting).
 */

interface Backend {
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

// ── In-memory LRU backend ──────────────────────────────────────────────────

const MAX_ENTRIES = 500;
// Counters are tiny and keyed per client, so they get their own, larger map: they never
// evict cached responses, and responses never reset a live counter.
const MAX_COUNTERS = 10_000;

interface MemEntry {
	value: unknown;
	expiresAt: number;
}

function createMemoryBackend(): Backend {
	// Map preserves insertion order, so the first key is the oldest — that's our
	// eviction victim once we exceed MAX_ENTRIES. Re-inserting on read keeps hot
	// keys young (LRU-ish without a separate access list).
	const store = new Map<string, MemEntry>();
	// Insertion order = window start order, so the first key is the oldest window (most
	// likely expired already) and the one to drop when full.
	const counters = new Map<string, { count: number; expiresAt: number }>();

	return {
		get<T>(key: string): Promise<T | undefined> {
			const entry = store.get(key);
			if (!entry) return Promise.resolve(undefined);
			if (Date.now() >= entry.expiresAt) {
				store.delete(key);
				return Promise.resolve(undefined);
			}
			// Touch: move to the most-recent end.
			store.delete(key);
			store.set(key, entry);
			return Promise.resolve(entry.value as T);
		},
		set<T>(key: string, value: T, ttlMs: number): Promise<void> {
			store.delete(key);
			store.set(key, { value, expiresAt: Date.now() + ttlMs });
			if (store.size > MAX_ENTRIES) {
				const oldest = store.keys().next().value;
				if (oldest !== undefined) store.delete(oldest);
			}
			return Promise.resolve();
		},
		incr(key: string, ttlMs: number): Promise<number> {
			const now = Date.now();
			const entry = counters.get(key);
			if (entry && now < entry.expiresAt) {
				entry.count += 1;
				return Promise.resolve(entry.count);
			}
			counters.delete(key);
			counters.set(key, { count: 1, expiresAt: now + ttlMs });
			if (counters.size > MAX_COUNTERS) {
				const oldest = counters.keys().next().value;
				if (oldest !== undefined) counters.delete(oldest);
			}
			return Promise.resolve(1);
		},
		clear() {
			store.clear();
			counters.clear();
		}
	};
}

// ── Redis backend (optional, lazy) ─────────────────────────────────────────

function createRedisBackend(url: string): Backend {
	// `redis` is an optional dependency — only required when REDIS_URL is set. Loaded
	// lazily so the app runs without it installed. If the import fails, we surface a
	// clear error rather than silently losing caching.
	let clientPromise: Promise<{
		get: (k: string) => Promise<string | null>;
		set: (k: string, v: string, opts: { PX: number }) => Promise<unknown>;
		incr: (k: string) => Promise<number>;
		pExpire: (k: string, ms: number) => Promise<unknown>;
		flushDb: () => Promise<unknown>;
	}> | null = null;

	async function client() {
		if (!clientPromise) {
			clientPromise = (async () => {
				// @vite-ignore — `redis` is an optional dep resolved at runtime only when
				// REDIS_URL is set; the ignore stops Vite failing the build when it's absent.
				const pkg = 'redis';
				const { createClient } = await import(/* @vite-ignore */ pkg);
				const c = createClient({ url });
				c.on('error', (err: unknown) => console.error('[cache] redis error', err));
				await c.connect();
				return c as never;
			})();
		}
		return clientPromise;
	}

	return {
		async get<T>(key: string): Promise<T | undefined> {
			try {
				const raw = await (await client()).get(key);
				return raw === null ? undefined : (JSON.parse(raw) as T);
			} catch (err) {
				// Treat any backend failure as a cache miss — never break the request path.
				console.error('[cache] redis get failed', err);
				return undefined;
			}
		},
		async set<T>(key: string, value: T, ttlMs: number): Promise<void> {
			try {
				await (await client()).set(key, JSON.stringify(value), { PX: ttlMs });
			} catch (err) {
				console.error('[cache] redis set failed', err);
			}
		},
		async incr(key: string, ttlMs: number): Promise<number> {
			try {
				const c = await client();
				const count = await c.incr(key);
				// The first hit opens the window; later hits leave its expiry alone.
				if (count === 1) await c.pExpire(key, ttlMs);
				return count;
			} catch (err) {
				// Fail open, like get/set: a Redis outage must not turn into 429s.
				console.error('[cache] redis incr failed', err);
				return 0;
			}
		},
		async clear() {
			await (await client()).flushDb();
		}
	};
}

// ── Backend selection ──────────────────────────────────────────────────────

const backend: Backend = env.REDIS_URL ? createRedisBackend(env.REDIS_URL) : createMemoryBackend();

/**
 * Returns the cached value for `key`, or runs `fetcher`, stores its result for `ttlMs`,
 * and returns it. On any cache-backend failure the fetcher still runs, so caching can
 * never make a request fail — only slower.
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
	const hit = await backend.get<T>(key);
	if (hit !== undefined) return hit;

	const value = await fetcher();
	await backend.set(key, value, ttlMs);
	return value;
}

/**
 * Adds 1 to the fixed-window counter at `key` and returns the new count. The window
 * (`ttlMs`) starts on the first hit; afterwards the count starts over at 1. Returns 0 if the
 * backend fails, so callers that compare against a limit fail open.
 *
 * Without `REDIS_URL` the counters live in this process only (best effort on serverless,
 * where each instance counts separately); with it they are shared by every instance.
 *
 * @param key - Namespaced counter key, e.g. `rl:search:ip:203.0.113.7`.
 * @param ttlMs - Window length in milliseconds.
 */
export function incr(key: string, ttlMs: number): Promise<number> {
	return backend.incr(key, ttlMs);
}

/**
 * Clears the entire cache (and the counters). Intended for tests only.
 */
export async function clearCache(): Promise<void> {
	await backend.clear();
}
