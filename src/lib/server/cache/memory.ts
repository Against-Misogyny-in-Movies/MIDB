import type { Backend } from '#lib/server/cache/backend.ts';

const MAX_ENTRIES = 500;
// Counters are tiny and keyed per client, so they get their own, larger map: they never
// evict cached responses, and responses never reset a live counter.
const MAX_COUNTERS = 10_000;

interface MemEntry {
	value: unknown;
	expiresAt: number;
}

/**
 * In-process LRU with TTLs and fixed-window counters. It is the whole cache in tests and when
 * the Cache API is missing, and the per-isolate first level in front of the Cache API.
 */
export function createMemoryBackend(): Backend {
	// Map preserves insertion order, so the first key is the oldest: our eviction victim once
	// we exceed MAX_ENTRIES. Re-inserting on read keeps hot keys young (LRU-ish without a
	// separate access list).
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
