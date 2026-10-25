import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('$env/dynamic/private', () => ({ env: {} }));

const { getCached, incr, clearCache } = await import('$lib/server/cache');

beforeEach(async () => {
	vi.useFakeTimers();
	await clearCache();
});
afterEach(() => vi.useRealTimers());

describe('memory backend', () => {
	it('getCached stores the fetched value for the TTL', async () => {
		const fetcher = vi.fn(async () => 'v');
		await getCached('k', 1000, fetcher);
		await getCached('k', 1000, fetcher);
		expect(fetcher).toHaveBeenCalledOnce();
		vi.advanceTimersByTime(1000);
		await getCached('k', 1000, fetcher);
		expect(fetcher).toHaveBeenCalledTimes(2);
	});

	it('getCached stores nothing when the fetcher throws', async () => {
		await expect(
			getCached('k', 1000, async () => {
				throw new Error('down');
			})
		).rejects.toThrow('down');
		await expect(getCached('k', 1000, async () => 'ok')).resolves.toBe('ok');
	});

	it('incr counts per key', async () => {
		expect(await incr('a', 60_000)).toBe(1);
		expect(await incr('a', 60_000)).toBe(2);
		expect(await incr('b', 60_000)).toBe(1);
		expect(await incr('a', 60_000)).toBe(3);
	});

	it('incr starts the window on the first hit and starts over when it ends', async () => {
		await incr('a', 60_000);
		vi.advanceTimersByTime(30_000);
		// A later hit does not extend the window.
		expect(await incr('a', 60_000)).toBe(2);
		vi.advanceTimersByTime(29_999);
		expect(await incr('a', 60_000)).toBe(3);
		vi.advanceTimersByTime(1);
		expect(await incr('a', 60_000)).toBe(1);
	});

	it('counters and cached values do not share keys or eviction', async () => {
		await getCached('a', 60_000, async () => 'value');
		expect(await incr('a', 60_000)).toBe(1);
		await expect(getCached('a', 60_000, async () => 'other')).resolves.toBe('value');
	});

	it('clearCache resets the counters', async () => {
		await incr('a', 60_000);
		await clearCache();
		expect(await incr('a', 60_000)).toBe(1);
	});
});
