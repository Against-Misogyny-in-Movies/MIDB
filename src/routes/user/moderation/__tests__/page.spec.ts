import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';

const goto = vi.fn();

vi.mock('$app/forms', () => ({ enhance: () => ({ destroy() {} }) }));
vi.mock('$app/navigation', () => ({ goto: (...args: unknown[]) => goto(...args) }));

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

afterEach(() => {
	cleanup();
	goto.mockReset();
});

const tab = (name: RegExp) => screen.getByRole('tab', { name });

describe('the moderation tabs', () => {
	it('puts one tab in the tab order and controls only the rendered panel', () => {
		render(Page, { data: DATA, form: null } as never);
		const tabs = screen.getAllByRole('tab');
		expect(tabs.map((t) => t.getAttribute('tabindex'))).toEqual(['0', '-1', '-1', '-1', '-1']);
		expect(tabs.map((t) => t.getAttribute('aria-controls'))).toEqual([
			'panel-pending',
			null,
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

describe('the community-reports tab', () => {
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
		await fireEvent.click(tab(/MIDB community reports/));
		expect(screen.getByRole('heading', { name: 'Held' })).toBeTruthy();
		expect(screen.getByRole('heading', { name: 'Flagged titles 1' })).toBeTruthy();
		expect(screen.getByText('Counts look wrong: 1 open')).toBeTruthy();
		expect(screen.getByRole('link', { name: 'See community reports' }).getAttribute('href')).toBe(
			'?title=t2'
		);
		expect(tab(/MIDB community reports/).textContent).toContain('0');
	});

	it('opens on the community-reports tab when a title is open', () => {
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
		expect(tab(/MIDB community reports/).getAttribute('aria-selected')).toBe('true');
		expect(screen.getByText('This title has no community reports.')).toBeTruthy();
	});
});

describe('the community-reports URL', () => {
	it('opens the tab for ?tab=reports, and Pending otherwise', () => {
		const { unmount } = render(Page, { data: { ...DATA, tab: 'reports' }, form: null } as never);
		expect(tab(/MIDB community reports/).getAttribute('aria-selected')).toBe('true');
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
		expect(tab(/MIDB community reports/).textContent?.trim()).toBe('MIDB community reports0');
	});

	it('says so, with a way back, when the title has no reports or does not exist', () => {
		render(Page, { data: { ...DATA, titleId: 'gone' }, form: null } as never);
		expect(tab(/MIDB community reports/).getAttribute('aria-selected')).toBe('true');
		expect(
			screen.getByText('That title has no community reports or no longer exists.')
		).toBeTruthy();
		expect(
			screen.getByRole('link', { name: /Back to community reports/ }).getAttribute('href')
		).toBe('?tab=reports');
	});
});

const FILTERS = { sort: 'newest' as const, page: 1 };

function tableRow(id: string, over: Record<string, unknown> = {}) {
	return {
		comment: {
			id,
			parentId: null,
			rootId: null,
			body: `Body of ${id}`,
			status: 'published',
			moderationSource: null,
			moderationReason: null,
			createdAt: '2026-11-10T10:00:00Z',
			editedAt: null
		},
		author: { id: `u-${id}`, username: 'anna', avatarKey: null, role: 'user', displayName: 'anna' },
		title: { kind: 'movie', tmdbId: 348, name: 'Alien' },
		aiCategories: [],
		reports: [],
		authorCommentCount: 1,
		authorMutedUntil: null,
		severity: null,
		aiFailure: null,
		latestLabel: null,
		...over
	};
}

const TABLE_DATA = {
	...DATA,
	tab: 'table',
	filters: FILTERS,
	aiAvailable: true,
	table: { rows: [tableRow('c1'), tableRow('c2')], total: 2, page: 1, pageSize: 50 }
};

describe('the table tab', () => {
	it('renders the rows in a captioned table with the AI controls on', () => {
		render(Page, { data: TABLE_DATA, form: null } as never);
		expect(tab(/All comments/).getAttribute('aria-selected')).toBe('true');
		expect(screen.getByRole('table')).toBeTruthy();
		expect(screen.getAllByRole('row')).toHaveLength(3);
		expect(screen.getByText('Body of c1')).toBeTruthy();
		expect(screen.getByRole('button', { name: 'Search with AI' })).toHaveProperty(
			'disabled',
			false
		);
	});

	it('goes to the table URL when the tab is chosen from another one', async () => {
		render(Page, { data: DATA, form: null } as never);
		await fireEvent.click(tab(/All comments/));
		expect(goto).toHaveBeenCalledWith('?tab=table', { reset: false });
		expect(tab(/All comments/).getAttribute('aria-selected')).toBe('true');
	});

	it('does not go again when the table is already the URL', async () => {
		render(Page, { data: TABLE_DATA, form: null } as never);
		await fireEvent.click(tab(/Pending/));
		goto.mockClear();
		await fireEvent.click(tab(/All comments/));
		expect(goto).not.toHaveBeenCalled();
	});

	it('drops tab=table from the URL when another tab is chosen, and keeps the choice', async () => {
		render(Page, { data: TABLE_DATA, form: null } as never);
		await fireEvent.click(tab(/Recent actions/));
		expect(goto).toHaveBeenCalledExactlyOnceWith('?', { reset: false });
		await waitFor(() => expect(tab(/Recent actions/).getAttribute('aria-selected')).toBe('true'));
		goto.mockClear();
		await fireEvent.click(tab(/MIDB community reports/));
		expect(goto).toHaveBeenCalledExactlyOnceWith('?tab=reports', { reset: false });
	});

	it('reserves room for the table while it loads', () => {
		render(Page, { data: { ...TABLE_DATA, table: null, filters: null }, form: null } as never);
		expect(screen.getByLabelText('Loading comments').getAttribute('aria-busy')).toBe('true');
	});

	it('shows each active filter as a chip that removes only it', () => {
		render(Page, {
			data: {
				...TABLE_DATA,
				filters: { ...FILTERS, q: 'troll', status: ['pending', 'hidden'], minSeverity: 2 }
			},
			form: null
		} as never);
		const chips = within(screen.getByRole('list', { name: 'Active filters' }));
		expect(
			chips.getByRole('link', { name: 'Remove filter: Text: troll' }).getAttribute('href')
		).toBe('?tab=table&status=pending&status=hidden&severity=2');
		expect(
			chips
				.getByRole('link', { name: 'Remove filter: Status: Awaiting review' })
				.getAttribute('href')
		).toBe('?tab=table&q=troll&status=hidden&severity=2');
		expect(chips.getAllByRole('link')).toHaveLength(4);
	});

	it('says why the AI controls are off, and shows none, without a key', () => {
		render(Page, { data: { ...TABLE_DATA, aiAvailable: false }, form: null } as never);
		expect(screen.getByText(/AI search and scan are off/)).toBeTruthy();
		expect(screen.queryByRole('button', { name: 'Search with AI' })).toBeNull();
		expect(screen.queryByRole('button', { name: 'Scan this page' })).toBeNull();
	});

	it('keeps the filters closed until one is set, with the chips outside them', () => {
		const { unmount } = render(Page, { data: TABLE_DATA, form: null } as never);
		expect(document.querySelector<HTMLDetailsElement>('details.fields')?.open).toBe(false);
		unmount();
		render(Page, {
			data: { ...TABLE_DATA, filters: { ...FILTERS, q: 'troll' } },
			form: null
		} as never);
		expect(document.querySelector<HTMLDetailsElement>('details.fields')?.open).toBe(true);
		const chips = screen.getByRole('list', { name: 'Active filters' });
		expect(chips.closest('details.fields')).toBeNull();
	});

	it('sets the sort beside select-all, carrying the filters with it', () => {
		render(Page, {
			data: { ...TABLE_DATA, filters: { ...FILTERS, q: 'troll', sort: 'reports' } },
			form: null
		} as never);
		const sort = screen.getByLabelText('Sort') as unknown as HTMLSelectElement;
		expect(sort.value).toBe('reports');
		expect(screen.getByRole('option', { name: 'Most open reports' })).toBeTruthy();
		const formEl = sort.closest('form') as HTMLFormElement;
		expect(formEl.closest('details.fields')).toBeNull();
		expect(formEl.querySelector<HTMLInputElement>('input[name=q]')?.value).toBe('troll');
		expect(formEl.querySelector<HTMLInputElement>('input[name=tab]')?.value).toBe('table');
	});

	it('shows the bulk bar once a row is selected, and not before', async () => {
		render(Page, { data: TABLE_DATA, form: null } as never);
		expect(screen.queryByRole('region', { name: /selected comments/ })).toBeNull();
		await fireEvent.click(screen.getAllByRole('checkbox', { name: /by anna on Alien/ })[0]);
		const bar = within(screen.getByRole('region', { name: /selected comments/ }));
		expect(bar.getByText('selected')).toBeTruthy();
		expect(bar.getByRole('button', { name: 'Approve' })).toBeTruthy();
		await fireEvent.click(bar.getByRole('button', { name: 'Clear selection' }));
		expect(screen.queryByRole('region', { name: /selected comments/ })).toBeNull();
	});

	it('opens a row’s detail with the comment’s own actions', async () => {
		render(Page, { data: TABLE_DATA, form: null } as never);
		await fireEvent.click(screen.getAllByRole('button', { name: /Review/ })[0]);
		expect(screen.getByRole('button', { name: 'Hide' })).toBeTruthy();
		expect(screen.getByRole('button', { name: 'Close the comment by anna' })).toBeTruthy();
	});

	it('says so when no comment matches', () => {
		render(Page, {
			data: { ...TABLE_DATA, table: { rows: [], total: 0, page: 1, pageSize: 50 } },
			form: null
		} as never);
		expect(screen.getByText('No comments match these filters.')).toBeTruthy();
	});
});
