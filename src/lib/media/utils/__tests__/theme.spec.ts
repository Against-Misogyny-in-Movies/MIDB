import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ThemeState } from '../theme.svelte.ts';

type Listener = (event: { matches: boolean }) => void;

/** A `matchMedia` whose preference a test can flip. */
function stubMatchMedia(prefersDark: boolean) {
	const listeners: Listener[] = [];
	Object.defineProperty(window, 'matchMedia', {
		writable: true,
		value: vi.fn(() => ({
			matches: prefersDark,
			addEventListener: (_: string, listener: Listener) => listeners.push(listener)
		}))
	});
	return (matches: boolean) => listeners.forEach((listener) => listener({ matches }));
}

const meta = () => document.querySelector('meta[name="theme-color"]')?.getAttribute('content');
const root = () => document.documentElement.dataset.theme;

beforeEach(() => {
	localStorage.clear();
	delete document.documentElement.dataset.theme;
	document.head.innerHTML = '<meta name="theme-color" content="#fbfafc">';
});

describe('ThemeState', () => {
	it('is system before it starts, which is what the server renders', () => {
		const theme = new ThemeState();
		expect(theme.choice).toBe('system');
		expect(theme.resolved).toBe('light');
	});

	it('with nothing stored follows the device, pins no data-theme and stores nothing', () => {
		stubMatchMedia(true);
		const theme = new ThemeState();
		theme.start();
		expect(theme.choice).toBe('system');
		expect(theme.resolved).toBe('dark');
		expect(root()).toBeUndefined();
		expect(localStorage.getItem('theme')).toBeNull();
		expect(meta()).toBe('#141217');
	});

	it('reads a stored light or dark choice and pins it', () => {
		stubMatchMedia(false);
		localStorage.setItem('theme', 'dark');
		const theme = new ThemeState();
		theme.start();
		expect(theme.choice).toBe('dark');
		expect(root()).toBe('dark');
		expect(meta()).toBe('#141217');
	});

	it('treats an unknown stored value as system', () => {
		stubMatchMedia(false);
		localStorage.setItem('theme', 'sepia');
		const theme = new ThemeState();
		theme.start();
		expect(theme.choice).toBe('system');
	});

	it('set stores light and dark, and system removes the stored value and the pin', () => {
		stubMatchMedia(false);
		const theme = new ThemeState();
		theme.start();
		theme.set('dark');
		expect(localStorage.getItem('theme')).toBe('dark');
		expect(root()).toBe('dark');
		theme.set('light');
		expect(localStorage.getItem('theme')).toBe('light');
		expect(root()).toBe('light');
		expect(meta()).toBe('#fbfafc');
		theme.set('system');
		expect(localStorage.getItem('theme')).toBeNull();
		expect(root()).toBeUndefined();
	});

	it('toggle pins the other of light and dark, from system too', () => {
		stubMatchMedia(true);
		const theme = new ThemeState();
		theme.start();
		theme.toggle();
		expect(theme.choice).toBe('light');
		expect(localStorage.getItem('theme')).toBe('light');
		theme.toggle();
		expect(theme.choice).toBe('dark');
	});

	it('follows the device live while the choice is system, and ignores it for a fixed choice', () => {
		const change = stubMatchMedia(false);
		const theme = new ThemeState();
		theme.start();
		change(true);
		expect(theme.resolved).toBe('dark');
		expect(meta()).toBe('#141217');
		theme.set('light');
		change(true);
		expect(theme.resolved).toBe('light');
		expect(meta()).toBe('#fbfafc');
	});

	it('starts again without a second listener, and re-reads the stored choice', () => {
		const change = stubMatchMedia(false);
		const theme = new ThemeState();
		theme.start();
		localStorage.setItem('theme', 'dark');
		theme.start();
		expect(theme.choice).toBe('dark');
		change(true);
		expect(window.matchMedia).toHaveBeenCalledTimes(2);
	});

	it('keeps the choice in memory when storage throws', () => {
		stubMatchMedia(false);
		const theme = new ThemeState();
		const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
			throw new Error('denied');
		});
		theme.start();
		expect(() => theme.set('dark')).not.toThrow();
		expect(theme.choice).toBe('dark');
		expect(root()).toBe('dark');
		spy.mockRestore();
	});
});
