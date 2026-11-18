import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('$app/forms', () => ({ enhance: () => ({ destroy() {} }) }));
vi.mock('$app/navigation', () => ({ goto: vi.fn() }));

const { default: Page } = await import('../+page.svelte');
const { moderationStatus } = await import('#lib/media/utils/moderationStatus.svelte.js');
const { moderationPrefs, COLLAPSE_SEVERE_KEY, SHORTCUTS_KEY } =
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
	moderationPrefs.shortcuts = true;
	localStorage.clear();
});

describe('the status line', () => {
	const statusLine = () => document.querySelector('p.status');

	it('is a line under the tabs that says the result and what remains, for the eye: the toast announces it', () => {
		moderationStatus.say('hide');
		render(Page, {
			data: { ...DATA, counts: { ...DATA.counts, pending: 41 } },
			form: null
		} as never);
		const line = statusLine() as HTMLElement;
		expect(line.getAttribute('aria-hidden')).toBe('true');
		expect(line.hasAttribute('role')).toBe(false);
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
			name: 'Collapse comments of severity 2 and above'
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

describe('the shortcut setting and the shortcut list', () => {
	const setting = () =>
		screen.queryByRole<HTMLInputElement>('checkbox', { name: 'Single-key shortcuts' });
	const list = () => document.getElementById('shortcut-list');
	const opener = () => screen.getByRole('button', { name: 'Keyboard shortcuts' });
	const key = (name: string, init: KeyboardEventInit = {}) =>
		fireEvent.keyDown(document.body, { key: name, ...init });

	it('sits beside the collapse setting, on by default, and is kept in the browser when off', async () => {
		render(Page, { data: DATA, form: null } as never);
		expect(setting()?.checked).toBe(true);
		expect(setting()?.closest('.settings')).toBe(
			screen
				.getByRole('checkbox', { name: 'Collapse comments of severity 2 and above' })
				.closest('.settings')
		);
		await fireEvent.click(setting()!);
		expect(moderationPrefs.shortcuts).toBe(false);
		expect(localStorage.getItem(SHORTCUTS_KEY)).toBe('off');
		await fireEvent.click(setting()!);
		expect(localStorage.getItem(SHORTCUTS_KEY)).toBeNull();
	});

	it('is not on the tabs the shortcuts do not work on', () => {
		render(Page, { data: REPORTS_DATA, form: null } as never);
		expect(setting()).toBeNull();
		expect(screen.queryByRole('button', { name: 'Keyboard shortcuts' })).toBeNull();
	});

	it('opens the list from its button, with the focus on it, and closes on Close', async () => {
		render(Page, { data: DATA, form: null } as never);
		expect(list()).toBeNull();
		expect(opener().getAttribute('aria-expanded')).toBe('false');
		await fireEvent.click(opener());
		expect(list()).not.toBeNull();
		expect(opener().getAttribute('aria-expanded')).toBe('true');
		await waitFor(() =>
			expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Close' }))
		);
		await fireEvent.click(screen.getByRole('button', { name: 'Close' }));
		expect(list()).toBeNull();
		await waitFor(() => expect(document.activeElement).toBe(opener()));
	});

	it('opens on ? and closes on Escape, giving the focus back', async () => {
		render(Page, { data: DATA, form: null } as never);
		opener().focus();
		await key('?', { shiftKey: true });
		expect(list()).not.toBeNull();
		await key('Escape');
		expect(list()).toBeNull();
		await waitFor(() => expect(document.activeElement).toBe(opener()));
	});

	it('lists every shortcut, and says the keys are a second path to buttons', async () => {
		render(Page, { data: DATA, form: null } as never);
		await fireEvent.click(opener());
		const text = list()!.textContent ?? '';
		for (const does of [
			'Next and previous item',
			'Show a collapsed comment',
			'Approve comment',
			'Dismiss reports',
			'Restore comment',
			'Hide, opens the rule list',
			'Reject, opens the rule list',
			'This list'
		]) {
			expect(text).toContain(does);
		}
		expect(text).toContain('Every shortcut is also a button on the page.');
		expect([...list()!.querySelectorAll('kbd')].map((k) => k.textContent)).toEqual(
			expect.arrayContaining(['j', 'k', 'Enter', 's', 'a', 'd', 'r', 'h', 'x', 'Esc', '?'])
		);
	});

	it('does not open on ? when the setting is off, in a field or with a modifier, but the button does', async () => {
		moderationPrefs.setShortcuts(false);
		render(Page, { data: DATA, form: null } as never);
		await key('?', { shiftKey: true });
		expect(list()).toBeNull();
		await fireEvent.click(opener());
		expect(list()).not.toBeNull();
		await fireEvent.click(screen.getByRole('button', { name: 'Close' }));
		moderationPrefs.setShortcuts(true);
		await key('?', { shiftKey: true, ctrlKey: true });
		expect(list()).toBeNull();
		await fireEvent.keyDown(setting()!, { key: '?', shiftKey: true });
		expect(list()).toBeNull();
	});
});
