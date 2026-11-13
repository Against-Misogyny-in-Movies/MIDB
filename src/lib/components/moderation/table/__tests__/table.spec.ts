import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';

type Result = { type: string; data?: Record<string, unknown> };

const form = vi.hoisted(() => ({
	result: { type: 'success', data: {} } as { type: string; data?: Record<string, unknown> },
	update: vi.fn(async () => {}),
	submitterValue: null as string | null
}));
const goto = vi.hoisted(() => vi.fn(async () => {}));
const toasts = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));

// `enhance` runs the component's submit callback and its result handler, with an `update` the
// test replaces to stand for the page re-rendering after the action.
vi.mock('$app/forms', () => ({
	enhance: (
		node: HTMLFormElement,
		submit?: (input: {
			submitter: HTMLElement | null;
		}) => (opts: {
			result: Result;
			update: (options?: { reset?: boolean; navigate?: boolean }) => Promise<void>;
		}) => Promise<void> | void
	) => {
		const onSubmit = (event: Event) => {
			event.preventDefault();
			const submitter = (event as SubmitEvent).submitter ?? null;
			void submit?.({ submitter })({ result: form.result, update: form.update });
		};
		node.addEventListener('submit', onSubmit);
		return { destroy: () => node.removeEventListener('submit', onSubmit) };
	}
}));
vi.mock('$app/navigation', () => ({ goto }));
vi.mock('#lib/media/utils/toasts.svelte.js', () => ({ toasts }));

const { default: BulkBar } = await import('../bulkBar.svelte');
const { default: AiSearchBar } = await import('../aiSearchBar.svelte');
const { default: ModerationTable } = await import('../moderationTable.svelte');
const { default: TablePager } = await import('../tablePager.svelte');
const { default: TablePanel } = await import('../tablePanel.svelte');

afterEach(() => {
	cleanup();
	goto.mockClear();
	form.update.mockClear();
	toasts.success.mockReset();
	toasts.error.mockReset();
	form.result = { type: 'success', data: {} };
});

const FILTERS = { sort: 'newest' as const, page: 1 };

describe('bulkBar', () => {
	it('counts the selection and posts each id with the operation chosen', async () => {
		const onclear = vi.fn();
		render(BulkBar, { ids: ['c1', 'c2', 'c3'], onclear, fallbackIds: [] });
		const bar = within(screen.getByRole('region', { name: /selected comments/ }));
		expect(bar.getByText('3')).toBeTruthy();
		const approve = bar.getByRole('button', { name: 'Approve' }) as HTMLButtonElement;
		expect(approve.getAttribute('name')).toBe('op');
		expect(approve.getAttribute('value')).toBe('approve');
		const formEl = approve.closest('form') as HTMLFormElement;
		expect(formEl.getAttribute('action')).toBe('?/bulk');
		expect(
			[...formEl.querySelectorAll<HTMLInputElement>('input[name=ids]')].map((i) => i.value)
		).toEqual(['c1', 'c2', 'c3']);
	});

	it('asks before hiding the selection, naming how many, with a reason field', async () => {
		render(BulkBar, { ids: ['c1', 'c2'], onclear: () => {}, fallbackIds: [] });
		await fireEvent.click(screen.getByRole('button', { name: 'Hide' }));
		expect(screen.getByText(/Hide 2 selected comments\?/)).toBeTruthy();
		const confirm = screen.getByRole('button', { name: 'Hide 2 comments' });
		const formEl = confirm.closest('form') as HTMLFormElement;
		expect(formEl.getAttribute('action')).toBe('?/bulk');
		expect(formEl.querySelector<HTMLInputElement>('input[name=op]')?.value).toBe('hide');
		expect(formEl.querySelectorAll('input[name=ids]')).toHaveLength(2);
		expect(formEl.querySelector('input[name=reason]')).not.toBeNull();
		await fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
		expect(screen.queryByText(/Hide 2 selected/)).toBeNull();
		await waitFor(() =>
			expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Hide' }))
		);
	});

	it('words the bulk confirmations for the statuses they change', async () => {
		render(BulkBar, { ids: ['c1'], onclear: () => {}, fallbackIds: [] });
		await fireEvent.click(screen.getByRole('button', { name: 'Reject' }));
		expect(
			screen.getByText(
				/Reject 1 selected comment\? A pending or published one is taken out of view/
			)
		).toBeTruthy();
		expect(screen.getByText(/A comment in any other status stays as it is\./)).toBeTruthy();
		await fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
		await waitFor(() =>
			expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Reject' }))
		);
	});

	it('clears the selection once the action ends', async () => {
		const onclear = vi.fn();
		form.result = { type: 'success', data: { done: 'bulk', applied: 2, refused: 0 } };
		render(BulkBar, { ids: ['c1', 'c2'], onclear, fallbackIds: [] });
		await fireEvent.click(screen.getByRole('button', { name: 'Restore' }));
		await waitFor(() => expect(onclear).toHaveBeenCalled());
		expect(toasts.success).toHaveBeenCalledWith('2 comments changed.');
	});
});

describe('aiSearchBar', () => {
	it('opens the table with the filters the search chose, and says so', async () => {
		form.result = { type: 'success', data: { done: 'aiSearch', params: 'category=trolling' } };
		render(AiSearchBar, { aiAvailable: true, ids: ['c1'] });
		await fireEvent.input(screen.getByLabelText('Search in plain words'), {
			target: { value: 'trolling' }
		});
		await fireEvent.click(screen.getByRole('button', { name: 'Search with AI' }));
		await waitFor(() =>
			expect(goto).toHaveBeenCalledWith('?tab=table&category=trolling', { reset: false })
		);
		expect(toasts.success).toHaveBeenCalledWith('Filters set from the search.');
	});

	it('toasts a refused search and goes nowhere', async () => {
		form.result = { type: 'failure', data: { error: 'The AI service is busy.' } };
		render(AiSearchBar, { aiAvailable: true, ids: ['c1'] });
		await fireEvent.input(screen.getByLabelText('Search in plain words'), {
			target: { value: 'trolling' }
		});
		await fireEvent.click(screen.getByRole('button', { name: 'Search with AI' }));
		await waitFor(() => expect(toasts.error).toHaveBeenCalledWith('The AI service is busy.'));
		expect(goto).not.toHaveBeenCalled();
	});

	it('scans the page’s comments, reloads without resetting the form and reports', async () => {
		form.result = {
			type: 'success',
			data: { done: 'scan', matched: 2, checked: 3, notChecked: 1 }
		};
		render(AiSearchBar, { aiAvailable: true, ids: ['c1', 'c2', 'c3'] });
		await fireEvent.input(screen.getByLabelText('Scan for'), {
			target: { value: 'disparaging' }
		});
		const scan = screen.getByRole('button', { name: 'Scan this page' });
		const formEl = scan.closest('form') as HTMLFormElement;
		expect(formEl.getAttribute('action')).toBe('?/scan');
		expect(formEl.querySelectorAll('input[name=ids]')).toHaveLength(3);
		await fireEvent.click(scan);
		await waitFor(() =>
			expect(form.update).toHaveBeenCalledWith({ reset: false, navigate: false })
		);
		expect(toasts.success).toHaveBeenCalledWith(
			'Scan checked 3 comments: 2 matched. 1 comment not checked.'
		);
	});

	it('cannot scan a page with no comments', () => {
		render(AiSearchBar, { aiAvailable: true, ids: [] });
		expect(screen.getByRole('button', { name: 'Scan this page' })).toHaveProperty('disabled', true);
	});

	it('is one line, with the reason and no inputs, when the site has no key', () => {
		render(AiSearchBar, { aiAvailable: false, ids: ['c1'] });
		expect(screen.getByText(/this site has no API key set/)).toBeTruthy();
		expect(screen.queryByRole('textbox')).toBeNull();
		expect(screen.queryByRole('button')).toBeNull();
	});

	it('toasts a thrown error, the rate limit’s 429 included, and goes nowhere', async () => {
		form.result = { type: 'error', status: 429 } as Result;
		render(AiSearchBar, { aiAvailable: true, ids: ['c1'] });
		await fireEvent.input(screen.getByLabelText('Search in plain words'), {
			target: { value: 'trolling' }
		});
		await fireEvent.click(screen.getByRole('button', { name: 'Search with AI' }));
		await waitFor(() =>
			expect(toasts.error).toHaveBeenCalledWith('The request failed. Try again in a moment.')
		);
		expect(goto).not.toHaveBeenCalled();
		form.result = { type: 'error', status: 429, error: { message: 'Too many requests' } } as Result;
		await fireEvent.click(screen.getByRole('button', { name: 'Search with AI' }));
		await waitFor(() => expect(toasts.error).toHaveBeenLastCalledWith('Too many requests'));
	});

	it('toasts a scan that threw, without applying the error to the page', async () => {
		form.result = { type: 'error', status: 429, error: { message: 'Too many requests' } } as Result;
		render(AiSearchBar, { aiAvailable: true, ids: ['c1'] });
		await fireEvent.input(screen.getByLabelText('Scan for'), { target: { value: 'x' } });
		await fireEvent.click(screen.getByRole('button', { name: 'Scan this page' }));
		await waitFor(() => expect(toasts.error).toHaveBeenCalledWith('Too many requests'));
		expect(form.update).not.toHaveBeenCalled();
	});
});

describe('moderationTable', () => {
	const row = {
		comment: {
			id: 'c1',
			parentId: null,
			rootId: null,
			body: 'A comment',
			status: 'pending',
			moderationSource: 'ai',
			moderationReason: null,
			createdAt: '2026-11-10T10:00:00Z',
			editedAt: null
		},
		author: { id: 'u1', username: 'anna', avatarKey: null, role: 'user', displayName: 'anna' },
		title: { kind: 'movie', tmdbId: 348, name: 'Alien' },
		aiCategories: ['trolling', 'survivor-mockery'],
		reports: [
			{ reason: 'harassment', note: null, createdAt: '2026-11-10T11:00:00Z' },
			{ reason: 'harassment', note: null, createdAt: '2026-11-10T12:00:00Z' }
		],
		authorCommentCount: 4,
		authorMutedUntil: null,
		severity: 2,
		aiFailure: null,
		latestLabel: {
			concern: 'disparaging remarks',
			matched: true,
			categories: ['disparagement'],
			severity: 2,
			reason: 'Mocks a survivor.',
			createdAt: '2026-11-10T13:00:00Z'
		}
	};

	it('labels every column header, and each cell for the stacked layout', () => {
		render(ModerationTable, {
			rows: [row],
			me: { id: 'mod', role: 'moderator' },
			selected: []
		} as never);
		const headers = screen.getAllByRole('columnheader');
		expect(headers.every((h) => h.getAttribute('scope') === 'col')).toBe(true);
		expect(headers.map((h) => h.textContent?.trim())).toEqual([
			'Select',
			'Comment',
			'Author',
			'Title',
			'Status',
			'Automatic check',
			'Reports',
			'Scan',
			'Posted',
			'Actions'
		]);
		const labels = [...document.querySelectorAll('tbody td[data-label]')].map((td) =>
			td.getAttribute('data-label')
		);
		expect(labels).toEqual([
			'Comment',
			'Author',
			'Title',
			'Status',
			'Automatic check',
			'Reports',
			'Scan',
			'Posted'
		]);
	});

	it('shows readable categories and severity, the reports and the latest scan', () => {
		render(ModerationTable, {
			rows: [row],
			me: { id: 'mod', role: 'moderator' },
			selected: []
		} as never);
		expect(screen.getByText('Trolling')).toBeTruthy();
		expect(screen.getByText('Survivor mockery')).toBeTruthy();
		expect(screen.getByText('Severity 2')).toBeTruthy();
		expect(screen.getByText('2 open')).toBeTruthy();
		expect(screen.getByText('Harassment')).toBeTruthy();
		expect(screen.getByText('Matched')).toBeTruthy();
		expect(screen.getByText('disparaging remarks')).toBeTruthy();
		expect(screen.getByRole('link', { name: 'Alien' }).getAttribute('href')).toBe('/movie/348');
	});

	it('reads a comment with no verdict, no reports and no scan plainly', () => {
		render(ModerationTable, {
			rows: [
				{
					...row,
					aiCategories: [],
					reports: [],
					severity: null,
					latestLabel: null
				}
			],
			me: { id: 'mod', role: 'moderator' },
			selected: []
		} as never);
		expect(screen.getByText('Not checked')).toBeTruthy();
		expect(screen.getByText('None')).toBeTruthy();
		expect(screen.getByText('Not scanned')).toBeTruthy();
	});

	it('shows the scan’s reason in the opened detail', async () => {
		render(ModerationTable, {
			rows: [row],
			me: { id: 'mod', role: 'moderator' },
			selected: []
		} as never);
		const toggle = screen.getByRole('button', { name: 'Review the comment by anna' });
		expect(toggle.getAttribute('aria-expanded')).toBe('false');
		await fireEvent.click(toggle);
		expect(toggle.getAttribute('aria-expanded')).toBe('true');
		expect(screen.getByText(/Mocks a survivor\./)).toBeTruthy();
	});
});

describe('the row checkboxes', () => {
	const base = {
		comment: {
			id: 'c1',
			parentId: null,
			rootId: null,
			body: 'A comment',
			status: 'pending',
			moderationSource: null,
			moderationReason: null,
			createdAt: '2026-11-10T10:00:00Z',
			editedAt: null
		},
		title: { kind: 'movie', tmdbId: 348, name: 'Alien' },
		aiCategories: [],
		reports: [],
		authorCommentCount: 1,
		authorMutedUntil: null,
		severity: null,
		aiFailure: null,
		latestLabel: null
	};
	const author = (id: string, role: string) => ({
		id,
		username: id,
		avatarKey: null,
		role,
		displayName: id
	});
	const rows = [
		{ ...base, comment: { ...base.comment, id: 'c1' }, author: author('anna', 'user') },
		{ ...base, comment: { ...base.comment, id: 'c2' }, author: author('adm', 'administrator') },
		{ ...base, comment: { ...base.comment, id: 'c3' }, author: author('mod', 'moderator') }
	];
	const checkboxes = () =>
		screen.getAllByRole<HTMLInputElement>('checkbox', { name: /Select the comment by/ });

	it('disables the checkbox of a comment the moderator may not act on, with a reason', () => {
		render(ModerationTable, { rows, me: { id: 'mod', role: 'moderator' }, selected: [] } as never);
		expect(checkboxes().map((box) => box.disabled)).toEqual([false, true, true]);
		const reason = checkboxes()[1].getAttribute('aria-describedby')!;
		expect(document.getElementById(reason)?.textContent).toMatch(/administrator decides/);
		expect(checkboxes()[0].getAttribute('aria-describedby')).toBeNull();
	});

	it('leaves every checkbox enabled for an administrator', () => {
		render(ModerationTable, {
			rows,
			me: { id: 'a0', role: 'administrator' },
			selected: []
		} as never);
		expect(checkboxes().every((box) => !box.disabled)).toBe(true);
	});

	it('selects only the rows the moderator may act on with Select all', async () => {
		render(TablePanel, {
			table: { rows, total: 3, page: 1, pageSize: 25 },
			filters: FILTERS,
			aiAvailable: false,
			me: { id: 'mod', role: 'moderator' }
		} as never);
		await fireEvent.click(screen.getByRole('checkbox', { name: /Select all 1 on this page/ }));
		expect(checkboxes().map((box) => box.checked)).toEqual([true, false, false]);
	});
});

describe('tablePager', () => {
	it('links to the neighbouring pages with the filters kept', () => {
		render(TablePager, {
			filters: { ...FILTERS, q: 'x', page: 2 },
			total: 120,
			page: 2,
			pageSize: 50
		});
		expect(screen.getByRole('link', { name: 'Previous' }).getAttribute('href')).toBe(
			'?tab=table&q=x'
		);
		expect(screen.getByRole('link', { name: 'Next' }).getAttribute('href')).toBe(
			'?tab=table&q=x&page=3'
		);
		expect(screen.getByText(/of/).textContent).toContain('120');
	});

	it('disables Previous on the first page and Next on the last', () => {
		const { unmount } = render(TablePager, { filters: FILTERS, total: 10, page: 1, pageSize: 50 });
		expect(screen.queryByRole('link', { name: 'Previous' })).toBeNull();
		expect(screen.queryByRole('link', { name: 'Next' })).toBeNull();
		unmount();
		render(TablePager, { filters: { ...FILTERS, page: 3 }, total: 101, page: 3, pageSize: 50 });
		expect(screen.queryByRole('link', { name: 'Next' })).toBeNull();
		expect(screen.getByRole('link', { name: 'Previous' })).toBeTruthy();
	});
});
