import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TOAST_LIMIT, toastDuration, toasts } from '#lib/media/utils/toasts.svelte.js';

beforeEach(() => vi.useFakeTimers());

afterEach(() => {
	toasts.clear();
	vi.useRealTimers();
});

const texts = () => toasts.items.map((t) => t.text);

describe('toasts', () => {
	it('gives a short message five seconds and a long one time to read it', () => {
		expect(toastDuration({ tone: 'success', text: 'Saved.' })).toBe(5000);
		expect(toastDuration({ tone: 'warn', text: 'x'.repeat(100) })).toBe(7000);
	});

	it('keeps an error until it is closed', () => {
		expect(toastDuration({ tone: 'error', text: 'Failed.' })).toBeNull();
		const id = toasts.error('Failed.');
		vi.advanceTimersByTime(60_000);
		expect(texts()).toEqual(['Failed.']);
		toasts.dismiss(id);
		expect(texts()).toEqual([]);
	});

	it('closes a success or warning on its own', () => {
		toasts.success('Saved.');
		vi.advanceTimersByTime(4999);
		expect(texts()).toEqual(['Saved.']);
		vi.advanceTimersByTime(1);
		expect(texts()).toEqual([]);
	});

	it('holds a toast while it is paused and gives it its full time again after', () => {
		const id = toasts.success('Saved.');
		toasts.pause(id);
		vi.advanceTimersByTime(10_000);
		expect(texts()).toEqual(['Saved.']);
		toasts.resume(id);
		vi.advanceTimersByTime(4999);
		expect(texts()).toEqual(['Saved.']);
		vi.advanceTimersByTime(1);
		expect(texts()).toEqual([]);
	});

	it('shows the same message once, as the newest', () => {
		toasts.success('Saved.');
		toasts.error('Failed.');
		toasts.success('Saved.');
		expect(texts()).toEqual(['Failed.', 'Saved.']);
	});

	it('drops the oldest past the limit', () => {
		for (let i = 0; i <= TOAST_LIMIT; i++) toasts.success(`Message ${i}`);
		expect(texts()).toEqual(Array.from({ length: TOAST_LIMIT }, (_, i) => `Message ${i + 1}`));
	});
});
