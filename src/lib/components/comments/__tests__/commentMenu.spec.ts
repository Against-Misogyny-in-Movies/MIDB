import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import CommentMenu from '../commentMenu.svelte';

afterEach(cleanup);

const items = (onselect = vi.fn()) => [
	{ label: 'Edit', onselect },
	{ label: 'Delete', onselect: vi.fn() }
];

describe('CommentMenu', () => {
	it('opens on the first item, and an item closes the list and runs', async () => {
		const onselect = vi.fn();
		render(CommentMenu, { label: 'More actions', items: items(onselect) });
		const toggle = screen.getByRole('button', { name: 'More actions' });
		expect(screen.queryByRole('button', { name: 'Edit' })).toBeNull();
		await fireEvent.click(toggle);
		expect(toggle.getAttribute('aria-expanded')).toBe('true');
		await waitFor(() => expect(document.activeElement?.textContent?.trim()).toBe('Edit'));
		await fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
		expect(onselect).toHaveBeenCalledOnce();
		expect(screen.queryByRole('button', { name: 'Edit' })).toBeNull();
	});

	it('moves with the arrow keys and closes on Escape, back on the button', async () => {
		render(CommentMenu, { label: 'More actions', items: items() });
		const toggle = screen.getByRole('button', { name: 'More actions' });
		await fireEvent.click(toggle);
		const edit = await screen.findByRole('button', { name: 'Edit' });
		await fireEvent.keyDown(edit, { key: 'ArrowDown' });
		expect(document.activeElement?.textContent?.trim()).toBe('Delete');
		await fireEvent.keyDown(document.activeElement!, { key: 'Escape' });
		expect(screen.queryByRole('button', { name: 'Delete' })).toBeNull();
		await waitFor(() => expect(document.activeElement).toBe(toggle));
	});

	it('cannot open while disabled', () => {
		render(CommentMenu, { label: 'More actions', items: items(), disabled: true });
		expect(screen.getByRole('button', { name: 'More actions' })).toHaveProperty('disabled', true);
	});
});
