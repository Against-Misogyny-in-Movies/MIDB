import { cleanup, fireEvent, render, screen } from '@testing-library/svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import AppearanceCard from '../appearanceCard.svelte';

function stubMatchMedia(prefersDark: boolean) {
	Object.defineProperty(window, 'matchMedia', {
		writable: true,
		value: vi.fn(() => ({ matches: prefersDark, addEventListener: vi.fn() }))
	});
}

const radio = (name: string) => screen.getByRole<HTMLInputElement>('radio', { name });

beforeEach(() => {
	localStorage.clear();
	delete document.documentElement.dataset.theme;
	stubMatchMedia(false);
});

afterEach(cleanup);

describe('the appearance card', () => {
	it('is a labelled radio group of System, Light and Dark', () => {
		render(AppearanceCard);
		expect(screen.getByRole('heading', { name: 'Appearance' })).toBeTruthy();
		expect(screen.getByRole('group', { name: 'Theme' })).toBeTruthy();
		expect(screen.getAllByRole<HTMLInputElement>('radio').map((r) => r.value)).toEqual([
			'system',
			'light',
			'dark'
		]);
	});

	it('checks System when nothing is stored', () => {
		render(AppearanceCard);
		expect(radio('System').checked).toBe(true);
	});

	it('checks the stored choice once mounted', () => {
		localStorage.setItem('theme', 'dark');
		render(AppearanceCard);
		expect(radio('Dark').checked).toBe(true);
		expect(radio('System').checked).toBe(false);
	});

	it('Dark and Light pin the theme and store it; System removes both', async () => {
		render(AppearanceCard);
		await fireEvent.click(radio('Dark'));
		expect(document.documentElement.dataset.theme).toBe('dark');
		expect(localStorage.getItem('theme')).toBe('dark');
		await fireEvent.click(radio('Light'));
		expect(document.documentElement.dataset.theme).toBe('light');
		expect(localStorage.getItem('theme')).toBe('light');
		await fireEvent.click(radio('System'));
		expect(document.documentElement.dataset.theme).toBeUndefined();
		expect(localStorage.getItem('theme')).toBeNull();
		expect(radio('System').checked).toBe(true);
	});

	it('says the choice is kept in this browser', () => {
		render(AppearanceCard);
		expect(screen.getByText(/Saved in this browser/)).toBeTruthy();
	});
});
