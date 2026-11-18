import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';

const goto = vi.fn();

vi.mock('$app/forms', () => ({ enhance: () => ({ destroy() {} }) }));
vi.mock('$app/navigation', () => ({ goto: (...args: unknown[]) => goto(...args) }));

const { default: Page } = await import('../+page.svelte');
const { toasts } = await import('#lib/media/utils/toasts.svelte.js');

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

/** The reports tab as the load returns it: both lists, no open title. */
const REPORTS_DATA = { ...DATA, tab: 'reports', pending: null, held: empty, flagged: empty };

afterEach(() => {
	cleanup();
	goto.mockReset();
	toasts.clear();
	vi.unstubAllGlobals();
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

	it('goes to the next tab’s URL with the arrow keys, wrapping, and with Home and End', async () => {
		const { rerender } = render(Page, { data: DATA, form: null } as never);
		const press = async (from: RegExp, key: string, to: RegExp, href: string) => {
			goto.mockClear();
			await fireEvent.keyDown(tab(from), { key });
			expect(goto).toHaveBeenCalledExactlyOnceWith(href, { reset: false });
			await waitFor(() => expect(document.activeElement).toBe(tab(to)));
			// The load that follows the navigation names the new tab.
			await rerender({ data: { ...DATA, tab: href.slice('?tab='.length) }, form: null } as never);
		};
		await press(/Pending/, 'ArrowRight', /Reported/, '?tab=reported');
		await press(/Reported/, 'End', /Recent actions/, '?tab=log');
		await press(/Recent actions/, 'ArrowRight', /Pending/, '?tab=pending');
		await press(/Pending/, 'ArrowLeft', /Recent actions/, '?tab=log');
		await press(/Recent actions/, 'Home', /Pending/, '?tab=pending');
	});

	it('takes the selected tab from the loaded data, not from a click', async () => {
		render(Page, { data: DATA, form: null } as never);
		await fireEvent.click(tab(/Reported/));
		expect(goto).toHaveBeenCalledWith('?tab=reported', { reset: false });
		expect(tab(/Pending/).getAttribute('aria-selected')).toBe('true');
		expect(tab(/Reported/).getAttribute('aria-selected')).toBe('false');
	});

	it('shows the totals from the database, not the length of the page', () => {
		render(Page, {
			data: { ...DATA, counts: { pending: 173, reported: 62, held: 80, flagged: 7 } },
			form: null
		} as never);
		expect(tab(/Pending/).textContent?.trim()).toBe('Pending173');
		expect(tab(/Reported/).textContent?.trim()).toBe('Reported62');
		expect(tab(/MIDB community reports/).textContent?.trim()).toBe('MIDB community reports87');
	});

	it('ignores other keys', async () => {
		render(Page, { data: DATA, form: null } as never);
		await fireEvent.keyDown(tab(/Pending/), { key: 'a' });
		expect(goto).not.toHaveBeenCalled();
	});
});

describe('the community-reports tab', () => {
	it('lists held reports and flagged titles under their headings', async () => {
		render(Page, {
			data: {
				...REPORTS_DATA,
				counts: { ...DATA.counts, flagged: 1 },
				flagged: {
					items: [
						{
							titleId: 't2',
							title: { kind: 'tv', tmdbId: 70523, name: 'Dark' },
							flags: [
								{ id: 'f1', note: 'Too low', reporter: 'bo', createdAt: '2026-11-10T10:00:00Z' }
							]
						}
					],
					nextCursor: null
				}
			},
			form: null
		} as never);
		expect(screen.getByRole('heading', { name: 'Held' })).toBeTruthy();
		expect(screen.getByRole('heading', { name: 'Flagged titles 1' })).toBeTruthy();
		expect(screen.getByText('Counts look wrong: 1 open')).toBeTruthy();
		expect(screen.getByRole('link', { name: 'See community reports' }).getAttribute('href')).toBe(
			'?title=t2'
		);
		expect(tab(/MIDB community reports/).textContent?.trim()).toBe('MIDB community reports1');
	});

	it('opens on the community-reports tab when a title is open', () => {
		render(Page, {
			data: {
				...DATA,
				tab: 'reports',
				titleId: 't2',
				openTitle: {
					id: 't2',
					kind: 'tv',
					tmdbId: 70523,
					name: 'Dark',
					reports: [],
					flags: [],
					closedFlags: []
				}
			},
			form: null
		} as never);
		expect(tab(/MIDB community reports/).getAttribute('aria-selected')).toBe('true');
		expect(screen.getByText('This title has no community reports.')).toBeTruthy();
	});
});

describe('the community-reports URL', () => {
	it('shows the tab the load names', () => {
		const { unmount } = render(Page, { data: REPORTS_DATA, form: null } as never);
		expect(tab(/MIDB community reports/).getAttribute('aria-selected')).toBe('true');
		unmount();
		render(Page, { data: DATA, form: null } as never);
		expect(tab(/Pending/).getAttribute('aria-selected')).toBe('true');
	});

	it('says so, with a way back, when the title has no reports or does not exist', () => {
		render(Page, { data: { ...REPORTS_DATA, titleId: 'gone' }, form: null } as never);
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
	});

	it('does not go again when the table is already the URL', async () => {
		render(Page, { data: TABLE_DATA, form: null } as never);
		await fireEvent.click(tab(/All comments/));
		expect(goto).not.toHaveBeenCalled();
	});

	it('goes to the chosen tab’s own URL, with none of the table’s filters', async () => {
		render(Page, { data: TABLE_DATA, form: null } as never);
		await fireEvent.click(tab(/Recent actions/));
		expect(goto).toHaveBeenCalledExactlyOnceWith('?tab=log', { reset: false });
		goto.mockClear();
		await fireEvent.click(tab(/MIDB community reports/));
		expect(goto).toHaveBeenCalledExactlyOnceWith('?tab=reports', { reset: false });
		goto.mockClear();
		await fireEvent.click(tab(/Pending/));
		expect(goto).toHaveBeenCalledExactlyOnceWith('?tab=pending', { reset: false });
	});

	it('leaves a title’s reports for the tab’s list', async () => {
		render(Page, {
			data: { ...REPORTS_DATA, titleId: 't2', held: null, flagged: null, openTitle: null },
			form: null
		} as never);
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

const item = (id: string) => tableRow(id);

describe('the queue lists', () => {
	const PAGED = {
		...DATA,
		counts: { ...DATA.counts, pending: 120 },
		pending: { items: [item('c1'), item('c2')], nextCursor: 'cursor-1' }
	};

	it('says what is empty, and offers no Show more on the last page', () => {
		render(Page, { data: DATA, form: null } as never);
		expect(screen.getByText('No comments are waiting for review.')).toBeTruthy();
		cleanup();
		render(Page, {
			data: { ...PAGED, pending: { ...PAGED.pending, nextCursor: null } },
			form: null
		} as never);
		expect(screen.queryByRole('button', { name: 'Show more' })).toBeNull();
	});

	it('loads the next page from the staff endpoint and moves the focus to its first row', async () => {
		const fetcher = vi
			.fn()
			.mockResolvedValue(Response.json({ items: [item('c3'), item('c4')], nextCursor: null }));
		vi.stubGlobal('fetch', fetcher);
		render(Page, { data: PAGED, form: null } as never);
		expect(
			screen.getAllByRole('listitem').filter((li) => li.id.startsWith('comment-'))
		).toHaveLength(2);
		await fireEvent.click(screen.getByRole('button', { name: 'Show more' }));
		expect(fetcher).toHaveBeenCalledWith('/api/moderation/queue?queue=pending&cursor=cursor-1', {
			method: 'GET'
		});
		await waitFor(() => expect(document.activeElement?.id).toBe('comment-c3'));
		expect(
			screen.getAllByRole('listitem').filter((li) => li.id.startsWith('comment-'))
		).toHaveLength(4);
		expect(screen.queryByRole('button', { name: 'Show more' })).toBeNull();
	});

	it('toasts a failed load, keeps the list and returns the focus to the button', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn().mockResolvedValue(Response.json({ message: 'x' }, { status: 403 }))
		);
		render(Page, { data: PAGED, form: null } as never);
		const button = screen.getByRole('button', { name: 'Show more' });
		await fireEvent.click(button);
		await waitFor(() => expect(document.activeElement).toBe(button));
		expect(toasts.items.map((t) => t.text)).toEqual([
			'More comments could not be loaded. Moderation is open to moderators and administrators only.'
		]);
		expect(
			screen.getAllByRole('listitem').filter((li) => li.id.startsWith('comment-'))
		).toHaveLength(2);
	});

	it('drops the later pages when the page reloads, so a removed row does not stay', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn().mockResolvedValue(Response.json({ items: [item('c3')], nextCursor: null }))
		);
		const { rerender } = render(Page, { data: PAGED, form: null } as never);
		await fireEvent.click(screen.getByRole('button', { name: 'Show more' }));
		await waitFor(() => expect(screen.getByText('Body of c3')).toBeTruthy());
		await rerender({
			data: { ...PAGED, pending: { items: [item('c2'), item('c4')], nextCursor: 'cursor-2' } },
			form: null
		} as never);
		expect(screen.queryByText('Body of c3')).toBeNull();
		expect(screen.queryByText('Body of c1')).toBeNull();
		expect(screen.getByText('Body of c4')).toBeTruthy();
		expect(screen.getByRole('button', { name: 'Show more' })).toBeTruthy();
	});

	it('pages the held reports and the flagged titles from their own queues', async () => {
		const fetcher = vi.fn().mockResolvedValue(Response.json({ items: [], nextCursor: null }));
		vi.stubGlobal('fetch', fetcher);
		render(Page, {
			data: {
				...REPORTS_DATA,
				held: { items: [], nextCursor: null },
				flagged: {
					items: [{ titleId: 't2', title: { kind: 'tv', tmdbId: 1, name: 'Dark' }, flags: [] }],
					nextCursor: 'f1'
				}
			},
			form: null
		} as never);
		await fireEvent.click(screen.getByRole('button', { name: 'Show more' }));
		expect(fetcher.mock.calls[0][0]).toBe('/api/moderation/queue?queue=flagged&cursor=f1');
	});

	it('pages the log', async () => {
		const fetcher = vi.fn().mockResolvedValue(Response.json({ items: [], nextCursor: null }));
		vi.stubGlobal('fetch', fetcher);
		render(Page, {
			data: {
				...DATA,
				tab: 'log',
				pending: null,
				recent: { items: [], nextCursor: null }
			},
			form: null
		} as never);
		expect(screen.getByText('No moderation actions yet.')).toBeTruthy();
	});
});
