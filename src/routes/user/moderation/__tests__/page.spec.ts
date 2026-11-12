import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('$app/forms', () => ({ enhance: () => ({ destroy() {} }) }));

const { default: Page } = await import('../+page.svelte');

const DATA = {
	me: { id: 'mod', role: 'moderator' },
	pending: [],
	reported: [],
	recent: [],
	staleSources: []
};

afterEach(cleanup);

const tab = (name: RegExp) => screen.getByRole('tab', { name });

describe('the moderation tabs', () => {
	it('puts one tab in the tab order and controls only the rendered panel', () => {
		render(Page, { data: DATA, form: null } as never);
		const tabs = screen.getAllByRole('tab');
		expect(tabs.map((t) => t.getAttribute('tabindex'))).toEqual(['0', '-1', '-1']);
		expect(tabs.map((t) => t.getAttribute('aria-controls'))).toEqual(['panel-pending', null, null]);
		expect(document.getElementById('panel-pending')).not.toBeNull();
	});

	it('moves with the arrow keys, wrapping, and with Home and End', async () => {
		render(Page, { data: DATA, form: null } as never);
		await fireEvent.keyDown(tab(/Pending/), { key: 'ArrowRight' });
		await waitFor(() => expect(document.activeElement).toBe(tab(/Reported/)));
		expect(tab(/Reported/).getAttribute('aria-selected')).toBe('true');
		await fireEvent.keyDown(tab(/Reported/), { key: 'End' });
		await waitFor(() => expect(document.activeElement).toBe(tab(/Recent actions/)));
		await fireEvent.keyDown(tab(/Recent actions/), { key: 'ArrowRight' });
		await waitFor(() => expect(document.activeElement).toBe(tab(/Pending/)));
		await fireEvent.keyDown(tab(/Pending/), { key: 'ArrowLeft' });
		await waitFor(() => expect(document.activeElement).toBe(tab(/Recent actions/)));
		await fireEvent.keyDown(tab(/Recent actions/), { key: 'Home' });
		await waitFor(() => expect(document.activeElement).toBe(tab(/Pending/)));
		expect(tab(/Pending/).getAttribute('tabindex')).toBe('0');
		expect(tab(/Recent actions/).getAttribute('tabindex')).toBe('-1');
	});

	it('ignores other keys', async () => {
		render(Page, { data: DATA, form: null } as never);
		await fireEvent.keyDown(tab(/Pending/), { key: 'a' });
		expect(tab(/Pending/).getAttribute('aria-selected')).toBe('true');
	});
});
