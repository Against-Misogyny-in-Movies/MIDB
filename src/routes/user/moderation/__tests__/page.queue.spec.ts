import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('$app/forms', () => ({ enhance: () => ({ destroy() {} }) }));
vi.mock('$app/navigation', () => ({ goto: vi.fn() }));

const { default: Page } = await import('../+page.svelte');
const { moderationStatus } = await import('#lib/media/utils/moderationStatus.svelte.js');
const { moderationPrefs, COLLAPSE_SEVERE_KEY } =
	await import('#lib/media/utils/moderationPrefs.svelte.js');

const empty = { items: [], nextCursor: null };

const DATA = {
	me: { id: 'mod', role: 'moderator' },
	tab: 'pending',
	counts: { pending: 0, reported: 0, held: 0, flagged: 0 },
	pending: empty,
	reported: null,
	titleId: null,
	held: null,
	flagged: null,
	openTitle: null,
	recent: null,
	staleSources: []
};

const REPORTS_DATA = { ...DATA, tab: 'reports', pending: null, held: empty, flagged: empty };
const TABLE_DATA = {
	...DATA,
	tab: 'table',
	filters: { sort: 'newest' as const, page: 1 },
	aiAvailable: false,
	table: { rows: [], total: 0, page: 1, pageSize: 50 }
};

afterEach(() => {
	cleanup();
	moderationStatus.clear();
	moderationPrefs.collapseSevere = true;
	localStorage.clear();
});

describe('the status line', () => {
	const statusLine = () => document.querySelector('p.status');

	it('is a polite status under the tabs that says the result and what remains in the tab', () => {
		moderationStatus.say('hide');
		render(Page, {
			data: { ...DATA, counts: { ...DATA.counts, pending: 41 } },
			form: null
		} as never);
		const line = statusLine() as HTMLElement;
		expect(line.getAttribute('role')).toBe('status');
		expect(line.textContent).toBe('Hidden. 41 left in Pending.');
		expect(
			document.getElementById('tab-log')!.compareDocumentPosition(line) &
				Node.DOCUMENT_POSITION_FOLLOWING
		).toBeTruthy();
	});

	it('is there, empty, before the first action, so the first result moves nothing', () => {
		render(Page, { data: DATA, form: null } as never);
		expect(statusLine()?.textContent).toBe('');
	});

	it('counts the open tab, and says so when nothing is left', () => {
		moderationStatus.say('dismiss');
		render(Page, {
			data: {
				...DATA,
				tab: 'reported',
				pending: null,
				reported: empty,
				counts: { ...DATA.counts, reported: 0 }
			},
			form: null
		} as never);
		expect(statusLine()?.textContent).toBe('Reports dismissed. Nothing left in Reported.');
	});

	it('clears when another tab opens, and is not on the tabs that are not queues', async () => {
		moderationStatus.say('approve');
		const { rerender } = render(Page, { data: DATA, form: null } as never);
		expect(statusLine()?.textContent).toBe('Approved. Nothing left in Pending.');
		await rerender({
			data: { ...DATA, tab: 'log', pending: null, recent: empty },
			form: null
		} as never);
		expect(statusLine()).toBeNull();
		await rerender({ data: DATA, form: null } as never);
		expect(statusLine()?.textContent).toBe('');
	});

	it('is set by an action that went through, whatever it was', () => {
		moderationStatus.say('unknown-action');
		expect(moderationStatus.label).toBeNull();
		moderationStatus.say('ban');
		expect(moderationStatus.label).toBe('Account banned');
	});
});

describe('the collapse setting', () => {
	const control = () =>
		screen.queryByRole<HTMLInputElement>('checkbox', {
			name: 'Collapse the most severe comments'
		});

	it('is in the header on the queues and the table, on by default', () => {
		render(Page, { data: DATA, form: null } as never);
		expect(control()?.checked).toBe(true);
		expect(control()?.closest('header')).not.toBeNull();
		cleanup();
		render(Page, { data: TABLE_DATA, form: null } as never);
		expect(control()).not.toBeNull();
	});

	it('is not on the tabs it does not affect', () => {
		render(Page, { data: REPORTS_DATA, form: null } as never);
		expect(control()).toBeNull();
	});

	it('turns collapsing off for the page and keeps the choice in the browser', async () => {
		render(Page, { data: DATA, form: null } as never);
		await fireEvent.click(control()!);
		expect(moderationPrefs.collapseSevere).toBe(false);
		expect(localStorage.getItem(COLLAPSE_SEVERE_KEY)).toBe('off');
		await fireEvent.click(control()!);
		expect(localStorage.getItem(COLLAPSE_SEVERE_KEY)).toBeNull();
	});

	it('reads the stored choice when the page mounts', async () => {
		localStorage.setItem(COLLAPSE_SEVERE_KEY, 'off');
		render(Page, { data: DATA, form: null } as never);
		await waitFor(() => expect(control()?.checked).toBe(false));
	});
});
