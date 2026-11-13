import { cleanup, fireEvent, render, screen, within } from '@testing-library/svelte';
import { afterEach, describe, expect, it } from 'vitest';
import { toasts } from '#lib/media/utils/toasts.svelte.js';
import Toaster from '../toaster.svelte';

afterEach(() => {
	cleanup();
	toasts.clear();
});

describe('Toaster', () => {
	it('has its live regions on the page before any toast, so the first one is announced', () => {
		render(Toaster);
		expect(screen.getByRole('alert').children).toHaveLength(0);
		expect(screen.getByRole('status').children).toHaveLength(0);
	});

	it('announces an error at once and the rest politely', async () => {
		render(Toaster);
		toasts.error('The report was not saved.');
		toasts.success('Comment posted.');
		toasts.warn('Comment sent. It waits for a moderator.');
		await Promise.resolve();
		expect(within(screen.getByRole('alert')).getByText('The report was not saved.')).toBeTruthy();
		const polite = within(screen.getByRole('status'));
		expect(polite.getByText('Comment posted.')).toBeTruthy();
		expect(polite.getByText('Comment sent. It waits for a moderator.')).toBeTruthy();
	});

	it('closes a toast from its Close button', async () => {
		render(Toaster);
		toasts.error('The flag was not sent.');
		await fireEvent.click(await screen.findByRole('button', { name: 'Close' }));
		expect(screen.queryByText('The flag was not sent.')).toBeNull();
		expect(toasts.items).toEqual([]);
	});

	it('closes the newest toast on Escape, and names the message each Close button closes', async () => {
		render(Toaster);
		toasts.error('The flag was not sent.');
		toasts.success('Comment posted.');
		const close = await screen.findAllByRole('button', { name: 'Close' });
		expect(
			close.map((b) => document.getElementById(b.getAttribute('aria-describedby')!)?.textContent)
		).toEqual(['The flag was not sent.', 'Comment posted.']);
		await fireEvent.keyDown(window, { key: 'Escape' });
		expect(toasts.items.map((t) => t.text)).toEqual(['The flag was not sent.']);
	});
});
