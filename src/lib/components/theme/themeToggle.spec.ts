import { render, fireEvent } from '@testing-library/svelte';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import ThemeToggle from './themeToggle.svelte';

function stubMatchMedia(prefersDark: boolean) {
    Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: vi.fn((query: string) => ({
            matches: query.includes('dark') ? prefersDark : !prefersDark,
            media: query,
            onchange: null,
            addEventListener: vi.fn(),
            removeEventListener: vi.fn(),
            dispatchEvent: vi.fn(),
        })),
    });
}

beforeEach(() => {
    localStorage.clear();
    delete document.documentElement.dataset.theme;
});

describe('ThemeToggle', () => {
    it('defaults to light when system prefers light and no storage key', async () => {
        stubMatchMedia(false);
        const { findByRole } = render(ThemeToggle);
        const btn = await findByRole('button');
        expect(btn.dataset.mode).toBe('light');
        expect(document.documentElement.dataset.theme).toBe('light');
        expect(localStorage.getItem('theme')).toBe('light');
    });

    it('defaults to dark when system prefers dark and no storage key', async () => {
        stubMatchMedia(true);
        const { findByRole } = render(ThemeToggle);
        const btn = await findByRole('button');
        expect(btn.dataset.mode).toBe('dark');
        expect(document.documentElement.dataset.theme).toBe('dark');
    });

    it('toggles between light and dark on click', async () => {
        stubMatchMedia(false);
        const { findByRole } = render(ThemeToggle);
        const btn = await findByRole('button');

        // light → dark
        await fireEvent.click(btn);
        expect(btn.dataset.mode).toBe('dark');
        expect(document.documentElement.dataset.theme).toBe('dark');
        expect(localStorage.getItem('theme')).toBe('dark');

        // dark → light
        await fireEvent.click(btn);
        expect(btn.dataset.mode).toBe('light');
        expect(document.documentElement.dataset.theme).toBe('light');
        expect(localStorage.getItem('theme')).toBe('light');
    });

    it('respects pre-set localStorage theme on mount', async () => {
        stubMatchMedia(false);
        localStorage.setItem('theme', 'dark');
        const { findByRole } = render(ThemeToggle);
        const btn = await findByRole('button');
        expect(btn.dataset.mode).toBe('dark');
        expect(document.documentElement.dataset.theme).toBe('dark');
    });
});
