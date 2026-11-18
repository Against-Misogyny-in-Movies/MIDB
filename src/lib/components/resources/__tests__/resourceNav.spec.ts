import { cleanup, render, screen } from '@testing-library/svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ResourceNav from '../resourceNav.svelte';

const ITEMS = [
	{ id: 'first', label: 'First' },
	{ id: 'second', label: 'Second' }
];

/** A section whose top sits at `top` px from the viewport top. */
function section(id: string, top: number) {
	const el = document.createElement('section');
	el.id = id;
	el.getBoundingClientRect = () => ({ top }) as DOMRect;
	document.body.appendChild(el);
}

function viewport(innerHeight: number, scrollHeight: number, scrollY: number) {
	vi.stubGlobal('innerHeight', innerHeight);
	vi.stubGlobal('scrollY', scrollY);
	Object.defineProperty(document.documentElement, 'scrollHeight', {
		configurable: true,
		value: scrollHeight
	});
}

const current = () =>
	screen
		.getAllByRole('link')
		.find((a) => a.getAttribute('aria-current') === 'true')
		?.textContent?.trim();

beforeEach(() => {
	section('first', 0);
	section('second', 900);
});

afterEach(() => {
	cleanup();
	document.body.innerHTML = '';
	vi.unstubAllGlobals();
	Reflect.deleteProperty(document.documentElement, 'scrollHeight');
});

describe('resourceNav', () => {
	it('keeps the first section current when the page does not scroll', () => {
		viewport(1000, 1000, 0);
		render(ResourceNav, { items: ITEMS });
		expect(current()).toBe('First');
	});

	it('pins the last section current at the bottom of a page that scrolls', () => {
		viewport(800, 2000, 1200);
		render(ResourceNav, { items: ITEMS });
		expect(current()).toBe('Second');
	});

	it('marks the section above the scroll line current in the middle of a page that scrolls', () => {
		viewport(800, 2000, 100);
		render(ResourceNav, { items: ITEMS });
		expect(current()).toBe('First');
	});
});
