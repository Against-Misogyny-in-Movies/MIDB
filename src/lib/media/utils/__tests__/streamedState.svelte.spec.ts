import { afterEach, describe, expect, test } from 'vitest';
import { flushSync } from 'svelte';
import { createStreamedState } from '#lib/media/utils/streamedState.svelte.js';

describe('createStreamedState', () => {
	let cleanup: (() => void) | null = null;
	afterEach(() => {
		cleanup?.();
		cleanup = null;
	});

	function mount(initialPromise: Promise<string> | undefined) {
		const input = $state<{ promise: Promise<string> | undefined }>({ promise: initialPromise });
		let stream!: ReturnType<typeof createStreamedState<string, undefined>>;
		cleanup = $effect.root(() => {
			stream = createStreamedState<string, undefined>(() => input.promise, 'fallback', undefined);
		});
		flushSync();
		return { input, stream };
	}

	test('is the initial value while pending, then the resolved value', async () => {
		const { stream } = mount(Promise.resolve('done'));
		expect(stream.current).toBeUndefined();
		await Promise.resolve();
		await Promise.resolve();
		expect(stream.current).toBe('done');
	});

	test('is the fallback when the promise rejects', async () => {
		const { stream } = mount(Promise.reject(new Error('boom')));
		await Promise.resolve();
		await Promise.resolve();
		expect(stream.current).toBe('fallback');
	});

	test('stays at the initial value without a promise', () => {
		const { stream } = mount(undefined);
		expect(stream.current).toBeUndefined();
	});

	test('a stale promise never overwrites a newer one', async () => {
		let resolveOld!: (v: string) => void;
		const old = new Promise<string>((r) => (resolveOld = r));
		const { input, stream } = mount(old);
		input.promise = Promise.resolve('new');
		flushSync();
		await Promise.resolve();
		await Promise.resolve();
		expect(stream.current).toBe('new');
		resolveOld('old');
		await old;
		await Promise.resolve();
		expect(stream.current).toBe('new');
	});
});
