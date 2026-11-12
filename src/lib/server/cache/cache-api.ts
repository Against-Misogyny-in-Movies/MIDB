import type { Backend } from '#lib/server/cache/backend.ts';

/** Synthetic origin for the Cache API keys: nothing is ever fetched from it. */
const KEY_ORIGIN = 'https://cache.midb.internal/';
/** The entry's expiry in epoch ms, so a hit can give the memory level its remaining TTL. */
const EXPIRES_HEADER = 'x-midb-expires';

function keyUrl(key: string): string {
	return KEY_ORIGIN + encodeURIComponent(key);
}

/**
 * The Cache API (`caches.default`) behind a per-isolate memory first level. The Cache API is
 * per data centre and shared by every isolate there, so a value cached by one request serves
 * the next one on another isolate; the memory level answers repeats without a Cache API call.
 *
 * Values are stored as JSON, so they must survive `JSON.stringify` (the TMDB and DDD results
 * do). A Cache API failure counts as a miss, never as a failed request.
 *
 * The Cache API has no atomic increment, so counters stay in the memory level: they count per
 * isolate (best effort), and `clear` empties the memory level only.
 */
export function createCacheApiBackend(cache: Cache, l1: Backend): Backend {
	return {
		async get<T>(key: string): Promise<T | undefined> {
			const local = await l1.get<T>(key);
			if (local !== undefined) return local;
			try {
				const response = await cache.match(keyUrl(key));
				if (!response) return undefined;
				const remainingMs = Number(response.headers.get(EXPIRES_HEADER)) - Date.now();
				if (!(remainingMs > 0)) return undefined;
				const value = (await response.json()) as T;
				await l1.set(key, value, remainingMs);
				return value;
			} catch (err) {
				console.error('[cache] cache api get failed', err);
				return undefined;
			}
		},
		async set<T>(key: string, value: T, ttlMs: number): Promise<void> {
			await l1.set(key, value, ttlMs);
			const body = JSON.stringify(value);
			if (body === undefined) return;
			try {
				await cache.put(
					keyUrl(key),
					new Response(body, {
						headers: {
							'content-type': 'application/json',
							'cache-control': `max-age=${Math.max(1, Math.ceil(ttlMs / 1000))}`,
							[EXPIRES_HEADER]: String(Date.now() + ttlMs)
						}
					})
				);
			} catch (err) {
				console.error('[cache] cache api put failed', err);
			}
		},
		incr(key: string, ttlMs: number): Promise<number> {
			return l1.incr(key, ttlMs);
		},
		clear() {
			return l1.clear();
		}
	};
}
