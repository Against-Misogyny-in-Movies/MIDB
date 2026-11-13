import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('$app/forms', () => ({ enhance: () => ({ destroy() {} }) }));

const { default: Page } = await import('../+page.svelte');

const DATA = {
	me: { id: 'mod', role: 'moderator' },
	pending: [],
	reported: [],
	tab: null,
	titleId: null,
	held: [],
	flagged: [],
	openTitle: null,
	recent: [],
	staleSources: []
};

afterEach(cleanup);

const tab = (name: RegExp) => screen.getByRole('tab', { name });

describe('the moderation tabs', () => {
	it('puts one tab in the tab order and controls only the rendered panel', () => {
		render(Page, { data: DATA, form: null } as never);
		const tabs = screen.getAllByRole('tab');
		expect(tabs.map((t) => t.getAttribute('tabindex'))).toEqual(['0', '-1', '-1', '-1']);
		expect(tabs.map((t) => t.getAttribute('aria-controls'))).toEqual([
			'panel-pending',
			null,
			null,
			null
		]);
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

describe('the reader-reports tab', () => {
	it('lists held reports and flagged titles under their headings', async () => {
		render(Page, {
			data: {
				...DATA,
				flagged: [
					{
						titleId: 't2',
						title: { kind: 'tv', tmdbId: 70523, name: 'Dark' },
						flags: [
							{ id: 'f1', note: 'Too low', reporter: 'bo', createdAt: '2026-11-10T10:00:00Z' }
						]
					}
				]
			},
			form: null
		} as never);
		await fireEvent.click(tab(/Reader reports/));
		expect(screen.getByRole('heading', { name: 'Held' })).toBeTruthy();
		expect(screen.getByRole('heading', { name: 'Flagged titles 1' })).toBeTruthy();
		expect(screen.getByText('Counts look wrong: 1 open')).toBeTruthy();
		expect(screen.getByRole('link', { name: 'See reader reports' }).getAttribute('href')).toBe(
			'?title=t2'
		);
		expect(tab(/Reader reports/).textContent).toContain('0');
	});

	it('opens on the reader-reports tab when a title is open', () => {
		render(Page, {
			data: {
				...DATA,
				titleId: 't2',
				openTitle: {
					id: 't2',
					kind: 'tv',
					tmdbId: 70523,
					name: 'Dark',
					reports: []
				}
			},
			form: null
		} as never);
		expect(tab(/Reader reports/).getAttribute('aria-selected')).toBe('true');
		expect(screen.getByText('This title has no reader reports.')).toBeTruthy();
	});
});

describe('the reader-reports URL', () => {
	it('opens the tab for ?tab=reports, and Pending otherwise', () => {
		const { unmount } = render(Page, { data: { ...DATA, tab: 'reports' }, form: null } as never);
		expect(tab(/Reader reports/).getAttribute('aria-selected')).toBe('true');
		unmount();
		render(Page, { data: DATA, form: null } as never);
		expect(tab(/Pending/).getAttribute('aria-selected')).toBe('true');
	});

	it('counts only the held reports on the tab', () => {
		render(Page, {
			data: {
				...DATA,
				held: [],
				flagged: [{ titleId: 't2', title: { kind: 'tv', tmdbId: 1, name: 'Dark' }, flags: [] }]
			},
			form: null
		} as never);
		expect(tab(/Reader reports/).textContent?.trim()).toBe('Reader reports0');
	});

	it('says so, with a way back, when the title has no reports or does not exist', () => {
		render(Page, { data: { ...DATA, titleId: 'gone' }, form: null } as never);
		expect(tab(/Reader reports/).getAttribute('aria-selected')).toBe('true');
		expect(screen.getByText('That title has no reader reports or no longer exists.')).toBeTruthy();
		expect(screen.getByRole('link', { name: /Back to reader reports/ }).getAttribute('href')).toBe(
			'?tab=reports'
		);
	});
});
