import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { DebouncedQuery } from '$lib/media/utils/debouncedQuery.svelte.js';

/** A source whose calls stay pending until the test resolves them, one by one. */
function controlledSource() {
	const calls: { query: string; signal: AbortSignal; resolve: (v: string) => void }[] = [];
	const source = vi.fn(
		(query: string, signal: AbortSignal) =>
			new Promise<string>((resolve) => calls.push({ query, signal, resolve }))
	);
	return { source, calls };
}

describe('DebouncedQuery', () => {
	beforeEach(() => vi.useFakeTimers());
	afterEach(() => vi.useRealTimers());

	it('fires only the last value pushed within the window, after the delay', async () => {
		const source = vi.fn(async (q: string) => `result:${q}`);
		const onResult = vi.fn();
		const query = new DebouncedQuery(source, onResult, { empty: '', delayMs: 500 });

		query.push('m');
		await vi.advanceTimersByTimeAsync(200);
		query.push('ma');
		await vi.advanceTimersByTimeAsync(200);
		query.push('mat');
		await vi.advanceTimersByTimeAsync(499);
		expect(source).not.toHaveBeenCalled();

		await vi.advanceTimersByTimeAsync(1);
		expect(source).toHaveBeenCalledTimes(1);
		expect(source).toHaveBeenCalledWith('mat', expect.any(AbortSignal));
		expect(onResult).toHaveBeenCalledExactlyOnceWith('result:mat');
	});

	it('defaults to a 500 ms window', async () => {
		const source = vi.fn(async () => 'x');
		const query = new DebouncedQuery(source, vi.fn(), { empty: '' });
		query.push('a');
		await vi.advanceTimersByTimeAsync(499);
		expect(source).not.toHaveBeenCalled();
		await vi.advanceTimersByTimeAsync(1);
		expect(source).toHaveBeenCalledOnce();
	});

	it('aborts the in-flight request on a newer value, and drops its late response', async () => {
		const { source, calls } = controlledSource();
		const onResult = vi.fn();
		const query = new DebouncedQuery(source, onResult, { empty: '', delayMs: 500 });

		query.push('old');
		await vi.advanceTimersByTimeAsync(500);
		expect(calls).toHaveLength(1);

		// A newer value aborts the stale fetch right away, before its own window elapses.
		query.push('new');
		expect(calls[0].signal.aborted).toBe(true);
		await vi.advanceTimersByTimeAsync(500);
		expect(calls).toHaveLength(2);

		// Newer response first, then the stale one lands late: the stale one is ignored.
		calls[1].resolve('new-result');
		await vi.advanceTimersByTimeAsync(0);
		calls[0].resolve('old-result');
		await vi.advanceTimersByTimeAsync(0);
		expect(onResult.mock.calls).toEqual([['new-result']]);
	});

	it('ignores a stale response that resolves before the newer one', async () => {
		const { source, calls } = controlledSource();
		const onResult = vi.fn();
		const query = new DebouncedQuery(source, onResult, { empty: '', delayMs: 500 });

		query.push('old');
		await vi.advanceTimersByTimeAsync(500);
		query.push('new');
		calls[0].resolve('old-result');
		await vi.advanceTimersByTimeAsync(0);
		expect(onResult).not.toHaveBeenCalled();

		await vi.advanceTimersByTimeAsync(500);
		calls[1].resolve('new-result');
		await vi.advanceTimersByTimeAsync(0);
		expect(onResult.mock.calls).toEqual([['new-result']]);
	});

	it('clears to the empty value at once for a blank query, without fetching', async () => {
		const { source, calls } = controlledSource();
		const onResult = vi.fn();
		const query = new DebouncedQuery(source, onResult, { empty: 'EMPTY', delayMs: 500 });

		query.push('matrix');
		await vi.advanceTimersByTimeAsync(500);
		query.push('   ');
		expect(onResult).toHaveBeenCalledExactlyOnceWith('EMPTY');
		expect(calls[0].signal.aborted).toBe(true);

		await vi.advanceTimersByTimeAsync(1000);
		expect(source).toHaveBeenCalledOnce();
		query.push('');
		expect(onResult).toHaveBeenLastCalledWith('EMPTY');
		expect(source).toHaveBeenCalledOnce();
	});

	it('cancel() drops the pending query and delivers nothing', async () => {
		const source = vi.fn(async () => 'x');
		const onResult = vi.fn();
		const query = new DebouncedQuery(source, onResult, { empty: '', delayMs: 500 });
		query.push('a');
		query.cancel();
		await vi.advanceTimersByTimeAsync(1000);
		expect(source).not.toHaveBeenCalled();
		expect(onResult).not.toHaveBeenCalled();
	});

	it('delivers the empty value when the source rejects', async () => {
		const onResult = vi.fn();
		const query = new DebouncedQuery(
			async () => {
				throw new TypeError('network down');
			},
			onResult,
			{ empty: 'EMPTY', delayMs: 500 }
		);
		query.push('a');
		await vi.advanceTimersByTimeAsync(500);
		expect(onResult).toHaveBeenCalledExactlyOnceWith('EMPTY');
	});
});
