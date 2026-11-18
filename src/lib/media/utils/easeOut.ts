import { slide } from 'svelte/transition';
import { moderationStatus } from '#lib/media/utils/moderationStatus.svelte.js';

/** The shared state-change transition, in milliseconds (`0.15s ease` in the CSS). */
export const EASE_MS = 150;

/**
 * How long an out transition runs: the shared 0.15s while a moderation action is running, so a
 * tab change that removes a whole list is instant, and never under `prefers-reduced-motion` or
 * without the Web Animations API.
 */
function outroMs(node: Element): number {
	const reduced =
		typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
	return moderationStatus.acting && !reduced && typeof node.animate === 'function' ? EASE_MS : 0;
}

/** The out transition of a row an action removed: its height closes over the shared transition. */
export function easeOut(node: Element) {
	return slide(node, { duration: outroMs(node) });
}

/**
 * The out transition of the panel of a removed row: it is out of the way at once, and leaves the
 * DOM with the row. A list removes a row and its panel in one step, and Svelte 5.57 keeps both
 * when only one of them has an out transition, so the panel needs its own.
 */
export function vanishOut(node: Element) {
	return {
		duration: outroMs(node),
		css: () =>
			'height: 0; min-height: 0; padding: 0; margin: 0; border-width: 0; overflow: hidden; opacity: 0'
	};
}
