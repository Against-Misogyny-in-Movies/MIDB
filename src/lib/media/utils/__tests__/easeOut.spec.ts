import { afterEach, describe, expect, it, vi } from 'vitest';
import { EASE_MS, easeOut } from '#lib/media/utils/easeOut.ts';
import { moderationStatus } from '#lib/media/utils/moderationStatus.svelte.js';

afterEach(() => {
	moderationStatus.acting = false;
	vi.unstubAllGlobals();
});

const node = () => {
	const el = document.createElement('li');
	el.animate = vi.fn() as never;
	return el;
};

const reduced = (on: boolean) =>
	vi.stubGlobal(
		'matchMedia',
		vi.fn(() => ({ matches: on }))
	);

describe('easeOut', () => {
	it('closes over the shared 0.15s while an action runs', () => {
		reduced(false);
		moderationStatus.acting = true;
		expect(easeOut(node()).duration).toBe(EASE_MS);
		expect(EASE_MS).toBe(150);
	});

	it('is instant when no action runs, so a tab change removes a list at once', () => {
		reduced(false);
		expect(easeOut(node()).duration).toBe(0);
	});

	it('is instant under prefers-reduced-motion', () => {
		reduced(true);
		moderationStatus.acting = true;
		expect(easeOut(node()).duration).toBe(0);
	});

	it('is instant without the Web Animations API', () => {
		reduced(false);
		moderationStatus.acting = true;
		const el = node();
		(el as { animate?: unknown }).animate = undefined;
		expect(easeOut(el).duration).toBe(0);
	});
});
