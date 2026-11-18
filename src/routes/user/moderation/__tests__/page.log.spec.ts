import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('$app/forms', () => ({ enhance: () => ({ destroy() {} }) }));
vi.mock('$app/navigation', () => ({ goto: vi.fn() }));

const { default: Page } = await import('../+page.svelte');

afterEach(() => {
	cleanup();
	vi.unstubAllGlobals();
});

const empty = { items: [], nextCursor: null };
const ACTION_ROW = {
	id: 'a1',
	action: 'mute',
	reason: null,
	rule: null,
	createdAt: '2026-11-17T10:00:00.000Z',
	actor: {
		id: 'ada',
		username: 'ada_1234',
		avatarKey: null,
		role: 'moderator',
		displayName: 'ada_1234'
	},
	targetUser: {
		id: 'w',
		username: 'woolf_2210',
		avatarKey: null,
		role: 'user',
		displayName: 'woolf_2210'
	},
	muteHours: 24,
	commentBody: null,
	commentId: null,
	commentStatus: null,
	commentEditedAt: null,
	inForce: null,
	flag: null,
	reverses: null,
	title: null
};

const DATA = {
	me: { id: 'mod', role: 'moderator' },
	tab: 'log',
	counts: { pending: 0, reported: 0, held: 0, flagged: 0 },
	pending: null,
	reported: null,
	titleId: null,
	held: null,
	flagged: null,
	openTitle: null,
	recent: empty,
	logFilters: null,
	logParams: '',
	unknownNames: [],
	staleSources: []
};

/** The value of the form field `name`. */
const field = (name: string) =>
	(document.querySelector(`[name=${name}]`) as unknown as { value: string }).value;

describe('the log tab', () => {
	const NO_FILTERS = { action: null, actor: null, account: null };
	const logData = (over: Record<string, unknown> = {}) => ({
		...DATA,
		logFilters: NO_FILTERS,
		...over
	});

	it('shows the empty log with its filters, and says an empty log has no actions yet', () => {
		render(Page, { data: logData(), form: null } as never);
		expect(screen.getByText('No moderation actions yet.')).toBeTruthy();
		expect(screen.getByRole('region', { name: 'Log filters' })).toBeTruthy();
		expect(screen.queryByRole('list', { name: 'Active filters' })).toBeNull();
	});

	it('shows a chip for each active log filter, each removing only its own', () => {
		render(Page, {
			data: logData({
				logFilters: { action: 'restrictions', actor: 'ada_1234', account: 'woolf_2210' }
			}),
			form: null
		} as never);
		const chips = within(screen.getByRole('list', { name: 'Active filters' })).getAllByRole('link');
		expect(chips.map((c) => [c.textContent?.trim(), c.getAttribute('href')])).toEqual([
			['Action: Mutes and bans', '?tab=log&actor=ada_1234&account=woolf_2210'],
			['Staff: ada_1234', '?tab=log&action=restrictions&account=woolf_2210'],
			['Account: woolf_2210', '?tab=log&action=restrictions&actor=ada_1234']
		]);
		expect(screen.getByText('No moderation actions match these filters.')).toBeTruthy();
		expect(screen.getByRole('link', { name: 'Clear filters' }).getAttribute('href')).toBe(
			'?tab=log'
		);
	});

	it('fills the form from the URL’s filters', () => {
		render(Page, {
			data: logData({ logFilters: { action: 'mute', actor: 'ada_1234', account: null } }),
			form: null
		} as never);
		expect(field('action')).toBe('mute');
		expect(field('actor')).toBe('ada_1234');
		expect(field('account')).toBe('');
		expect(document.querySelector('form [name=tab]')?.getAttribute('value')).toBe('log');
	});

	it('offers the actions in four groups, each with an all option', () => {
		render(Page, { data: logData(), form: null } as never);
		const groups = [...document.querySelectorAll('select[name=action] optgroup')];
		expect(groups.map((g) => g.getAttribute('label'))).toEqual([
			'Comments',
			'Mutes and bans',
			'Community reports and flags',
			'Roles and notes'
		]);
		expect(groups[1].querySelector('option')?.textContent?.trim()).toBe('All mutes and bans');
	});

	it('says a name no account has', () => {
		render(Page, {
			data: logData({
				logFilters: { action: null, actor: null, account: 'nobody_1' },
				unknownNames: ['account']
			}),
			form: null
		} as never);
		expect(screen.getByText('No account is named nobody_1.')).toBeTruthy();
	});

	it('pages the log under its filter, by the ids the filter resolved to', async () => {
		const fetcher = vi.fn().mockResolvedValue(Response.json({ items: [], nextCursor: null }));
		vi.stubGlobal('fetch', fetcher);
		render(Page, {
			data: logData({
				recent: { items: [{ ...ACTION_ROW }], nextCursor: 'cur1' },
				logFilters: { action: 'mute', actor: null, account: 'woolf_2210' },
				logParams: '&action=mute&account=acct-1'
			}),
			form: null
		} as never);
		await fireEvent.click(screen.getByRole('button', { name: 'Show more' }));
		await waitFor(() => expect(fetcher).toHaveBeenCalled());
		expect(fetcher.mock.calls[0][0]).toBe(
			'/api/moderation/queue?queue=log&cursor=cur1&action=mute&account=acct-1'
		);
	});
});

describe('the header’s Staff roles link', () => {
	it('is for administrators only', () => {
		const { unmount } = render(Page, {
			data: { ...DATA, me: { id: 'adm', role: 'administrator' } },
			form: null
		} as never);
		expect(screen.getByRole('link', { name: 'Staff roles' }).getAttribute('href')).toBe(
			'/user/moderation/staff'
		);
		unmount();
		render(Page, { data: DATA, form: null } as never);
		expect(screen.queryByRole('link', { name: 'Staff roles' })).toBeNull();
	});
});
