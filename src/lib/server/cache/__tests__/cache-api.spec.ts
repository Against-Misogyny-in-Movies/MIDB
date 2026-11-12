import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { clearCache, getCached, incr } from '#lib/server/cache/index.ts';
import { resetCloudflareStub, waitUntilPromises } from '#test/cloudflare-workers.stub.ts';

/** Lets the writes handed to `waitUntil` finish, as the runtime does after the response. */
async function settled(): Promise<void> {
	await Promise.all(waitUntilPromises);
}

/** A Cache API stand-in that keeps what `put` stores and ignores `max-age` (the spec drives expiry). */
function createFakeCache() {
	const entries = new Map<string, { body: string; headers: Headers }>();
	const cache = {
		match: vi.fn(async (url: string) => {
			const entry = entries.get(url);
			return entry ? new Response(entry.body, { headers: entry.headers }) : undefined;
		}),
		put: vi.fn(async (url: string, response: Response) => {
			entries.set(url, { body: await response.text(), headers: response.headers });
		})
	};
	return { cache, entries };
}

const KEY_URL = 'https://cache.midb.internal/tmdb%3Amovie%3A603';

let fake: ReturnType<typeof createFakeCache>;

beforeEach(async () => {
	resetCloudflareStub();
	vi.useFakeTimers();
	fake = createFakeCache();
	vi.stubGlobal('caches', { default: fake.cache });
	await clearCache();
});
afterEach(() => {
	vi.unstubAllGlobals();
	vi.useRealTimers();
});

describe('Cache API backend', () => {
	it('stores a miss under a synthetic key with the TTL as max-age', async () => {
		const fetcher = vi.fn(async () => ({ id: 603 }));
		await expect(getCached('tmdb:movie:603', 90_000, fetcher)).resolves.toEqual({ id: 603 });
		await settled();
		expect(fake.cache.put).toHaveBeenCalledOnce();
		const entry = fake.entries.get(KEY_URL);
		expect(entry?.body).toBe('{"id":603}');
		expect(entry?.headers.get('cache-control')).toBe('max-age=90');
		expect(entry?.headers.get('content-type')).toBe('application/json');
	});

	it('rounds a sub-second TTL up to one second', async () => {
		await getCached('tmdb:movie:603', 200, async () => 'v');
		await settled();
		expect(fake.entries.get(KEY_URL)?.headers.get('cache-control')).toBe('max-age=1');
	});

	it('serves a hit from the Cache API when the memory level is empty, without running the fetcher', async () => {
		const fetcher = vi.fn(async () => ({ id: 603 }));
		await getCached('tmdb:movie:603', 60_000, fetcher);
		await settled();
		// Another isolate: same data centre cache, empty memory.
		await clearCache();
		await expect(getCached('tmdb:movie:603', 60_000, fetcher)).resolves.toEqual({ id: 603 });
		expect(fetcher).toHaveBeenCalledOnce();
		// The first call missed, the second one hit.
		expect(fake.cache.match).toHaveBeenCalledTimes(2);
	});

	it('answers repeats from the memory level without asking the Cache API again', async () => {
		const fetcher = vi.fn(async () => 'v');
		await getCached('tmdb:movie:603', 60_000, fetcher);
		await settled();
		await clearCache();
		await getCached('tmdb:movie:603', 60_000, fetcher);
		await getCached('tmdb:movie:603', 60_000, fetcher);
		// One miss, then one hit; the third call never reaches the Cache API.
		expect(fake.cache.match).toHaveBeenCalledTimes(2);
		expect(fetcher).toHaveBeenCalledOnce();
	});

	it('gives the memory level only the TTL that is left', async () => {
		const fetcher = vi.fn(async () => 'v');
		await getCached('tmdb:movie:603', 60_000, fetcher);
		await settled();
		await clearCache();
		vi.advanceTimersByTime(40_000);
		await getCached('tmdb:movie:603', 60_000, fetcher);
		// 20 s are left: the memory level expires with the Cache API entry, not 60 s later.
		vi.advanceTimersByTime(20_000);
		await getCached('tmdb:movie:603', 60_000, fetcher);
		expect(fetcher).toHaveBeenCalledTimes(2);
	});

	it('treats an entry past its expiry as a miss', async () => {
		const fetcher = vi.fn(async () => 'v');
		await getCached('tmdb:movie:603', 1000, fetcher);
		await settled();
		await clearCache();
		vi.advanceTimersByTime(1000);
		await getCached('tmdb:movie:603', 1000, fetcher);
		expect(fetcher).toHaveBeenCalledTimes(2);
	});

	it('treats a Cache API failure as a miss and still returns the value', async () => {
		const log = vi.spyOn(console, 'error').mockImplementation(() => {});
		fake.cache.match.mockRejectedValueOnce(new Error('cache down'));
		fake.cache.put.mockRejectedValueOnce(new Error('cache down'));
		await expect(getCached('tmdb:movie:603', 60_000, async () => 'v')).resolves.toBe('v');
		await settled();
		expect(log).toHaveBeenCalledTimes(2);
		log.mockRestore();
	});

	it('writes through waitUntil, off the request path', async () => {
		let finish: () => void = () => {};
		fake.cache.put.mockImplementationOnce(() => new Promise<void>((resolve) => (finish = resolve)));
		await expect(getCached('tmdb:movie:603', 60_000, async () => 'v')).resolves.toBe('v');
		expect(waitUntilPromises).toHaveLength(1);
		finish();
		await settled();
	});

	it('does not store, and does not fail, a value JSON cannot serialise', async () => {
		const log = vi.spyOn(console, 'error').mockImplementation(() => {});
		const circular: Record<string, unknown> = {};
		circular.self = circular;
		await expect(getCached('k', 60_000, async () => circular)).resolves.toBe(circular);
		await settled();
		expect(fake.cache.put).not.toHaveBeenCalled();
		expect(log).toHaveBeenCalledOnce();
		log.mockRestore();
	});

	it('stores nothing when the fetcher throws', async () => {
		await expect(
			getCached('tmdb:movie:603', 60_000, async () => {
				throw new Error('down');
			})
		).rejects.toThrow('down');
		expect(fake.cache.put).not.toHaveBeenCalled();
	});

	it('keeps counters in memory, never in the Cache API', async () => {
		expect(await incr('rl:RL_SEARCH:ip:1', 60_000)).toBe(1);
		expect(await incr('rl:RL_SEARCH:ip:1', 60_000)).toBe(2);
		expect(fake.cache.put).not.toHaveBeenCalled();
		expect(fake.cache.match).not.toHaveBeenCalled();
	});

	it('falls back to memory once `caches` is gone', async () => {
		vi.unstubAllGlobals();
		const fetcher = vi.fn(async () => 'v');
		await getCached('k', 60_000, fetcher);
		await getCached('k', 60_000, fetcher);
		expect(fetcher).toHaveBeenCalledOnce();
		expect(fake.cache.put).not.toHaveBeenCalled();
	});
});
