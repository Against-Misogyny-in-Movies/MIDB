import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type {
	FlaggedTitle,
	RecentAction,
	ReportAccount,
	TitleReport
} from '#lib/media/types/moderation.ts';

const form = vi.hoisted(() => ({
	update: async () => {},
	result: { type: 'success', data: {} } as { type: string; data?: Record<string, unknown> }
}));

vi.mock('$app/forms', () => ({
	enhance: (
		node: HTMLFormElement,
		submit?: () => (opts: {
			result: typeof form.result;
			update: () => Promise<void>;
		}) => Promise<void>
	) => {
		const onSubmit = (event: Event) => {
			event.preventDefault();
			void submit?.()({ result: form.result, update: () => form.update() });
		};
		node.addEventListener('submit', onSubmit);
		return { destroy: () => node.removeEventListener('submit', onSubmit) };
	}
}));

const { default: TitleReportRow } = await import('../titleReportRow.svelte');
const { default: CommunityReportsPanel } = await import('../communityReportsPanel.svelte');
const { default: ReportAnswers } = await import('../reportAnswers.svelte');
const { default: RecentActionRow } = await import('../recentActionRow.svelte');

const { toasts } = await import('#lib/media/utils/toasts.svelte.js');

afterEach(() => {
	cleanup();
	form.update = async () => {};
	form.result = { type: 'success', data: {} };
	toasts.clear();
});

/** The toasts showing, as `tone: text`. */
const shown = () => toasts.items.map((t) => `${t.tone}: ${t.text}`);

const DAY = 86_400_000;
const account = (over: Partial<ReportAccount> = {}): ReportAccount => ({
	userId: 'u1',
	username: 'anna',
	createdAt: new Date(Date.now() - 100 * DAY).toISOString(),
	reportCount: 3,
	commentCount: 1,
	role: 'user',
	countsFrom: new Date(Date.now() - 93 * DAY).toISOString(),
	restricted: null,
	...over
});

const NONE = {
	sexualPresent: 'present',
	partnerLevel: null,
	physicalLevel: null,
	stalkingLevel: null,
	objectificationLevel: null,
	framing: null,
	rapeMenDisImp: null,
	sexHarOnScrn: true,
	sexAdultTeen: null,
	childSexAbuse: null,
	incest: null,
	attemptedRape: null,
	rapeOffScrn: null,
	rapeOnScreen: false
} as const;

const UM = {
	rapeMenDisImp: false,
	sexHarOnScrn: false,
	sexAdultTeen: false,
	childSexAbuse: false,
	incest: false,
	attemptedRape: false,
	rapeOffScrn: false,
	rapeOnScreen: true
};

const titleReport = (over: Partial<TitleReport> = {}): TitleReport => ({
	account: account(),
	status: 'counted',
	holdReason: null,
	createdAt: '2026-11-10T10:00:00.000Z',
	answers: { ...NONE },
	um: null,
	...over
});

function mountRow(report: TitleReport, canAct = true, canRestrict = canAct) {
	const list = document.body.appendChild(document.createElement('ul'));
	return render(TitleReportRow, {
		props: { report, titleId: 't1', canAct, canRestrict },
		target: list
	});
}

describe('the title report row', () => {
	it('names the account once, in the header', () => {
		mountRow(titleReport());
		expect(screen.getAllByText(/anna/)).toHaveLength(1);
		expect(
			screen.getByText(/100 days old, 3 community reports not rejected, 1 comment/)
		).toBeTruthy();
	});

	it.each([
		[{ status: 'held' as const }, 'Held'],
		[{ status: 'rejected' as const }, 'Rejected'],
		[{}, 'Counted'],
		[{ account: account({ restricted: 'muted' }) }, 'Not counted: account muted'],
		[{ account: account({ restricted: 'banned' }) }, 'Not counted: account banned'],
		[
			{ account: account({ countsFrom: new Date(Date.now() + 3 * DAY).toISOString() }) },
			/^Counts from /
		]
	])('reads the status of %j as %s', (over, label) => {
		mountRow(titleReport(over));
		expect(screen.getByText(label)).toBeTruthy();
	});

	it('shows the hold reason as a badge', () => {
		mountRow(titleReport({ status: 'held', holdReason: 'burst' }));
		expect(screen.getByText('Burst on this title').className).toContain('badge');
	});

	it('groups the account actions under an Account label', () => {
		mountRow(titleReport());
		const group = screen.getByText('Account').closest('div')!;
		expect(within(group).getByRole('button', { name: 'Mute account' })).toBeTruthy();
		expect(
			within(group).getByRole('button', { name: 'Reject all from this account' })
		).toBeTruthy();
		expect(within(group).queryByRole('button', { name: 'Count it' })).toBeNull();
	});

	it('offers no account actions for an account the moderator cannot act on', () => {
		mountRow(titleReport({ account: account({ role: 'administrator' }) }), false);
		expect(screen.queryByText('Account')).toBeNull();
		expect(screen.queryByRole('button', { name: 'Mute account' })).toBeNull();
		expect(screen.queryByRole('button', { name: 'Reject all from this account' })).toBeNull();
		expect(screen.queryByRole('button', { name: 'Reject' })).toBeNull();
		expect(screen.queryByRole('button', { name: 'Count it' })).toBeNull();
		expect(screen.getByText('An administrator decides on this report.')).toBeTruthy();
	});

	it('offers an administrator their own report but not Mute or Ban on themselves', () => {
		mountRow(titleReport(), true, false);
		expect(screen.getByRole('button', { name: 'Reject' })).toBeTruthy();
		expect(screen.getByRole('button', { name: 'Reject all from this account' })).toBeTruthy();
		expect(screen.queryByRole('button', { name: 'Mute account' })).toBeNull();
		expect(screen.queryByRole('button', { name: 'Ban account' })).toBeNull();
	});

	it('asks before rejecting every report, naming the count and the consequence', async () => {
		mountRow(titleReport());
		await fireEvent.click(screen.getByRole('button', { name: 'Reject all from this account' }));
		expect(
			screen.getByText(
				/Reject all 3 community reports from anna\? They leave the counts on every title they cover\./
			)
		).toBeTruthy();
		const confirm = screen.getByRole('button', { name: 'Reject all community reports' });
		expect(confirm.closest('form')!.getAttribute('action')).toBe('?/rejectAccountReports');
		await fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
		expect(screen.queryByRole('button', { name: 'Reject all community reports' })).toBeNull();
	});

	it('says in the mute and ban sentences that the community reports leave the counts', async () => {
		mountRow(titleReport());
		await fireEvent.click(screen.getByRole('button', { name: 'Mute account' }));
		expect(
			screen.getByText(
				/Until the mute ends, the account cannot write, edit, delete, vote on or report comments, and its community reports leave the counts\./
			)
		).toBeTruthy();
		await fireEvent.click(screen.getByRole('button', { name: 'Ban account' }));
		expect(screen.getByText(/its community reports leave the counts/)).toBeTruthy();
	});

	it('passes UM’s flags to the answers of a contradicting report', () => {
		mountRow(titleReport({ status: 'held', holdReason: 'contradicts_source', um: UM }));
		expect(screen.getByRole('columnheader', { name: 'Unconsenting Media' })).toBeTruthy();
	});
});

describe('the reader answers next to Unconsenting Media', () => {
	it('marks and sorts first the rows where the reader and UM differ', () => {
		render(ReportAnswers, {
			answers: { ...NONE, sexHarOnScrn: true, rapeOnScreen: false },
			um: UM
		});
		const rows = screen.getAllByRole('row').slice(1);
		expect(rows).toHaveLength(8);
		const differing = rows.filter((r) => within(r).queryByText('Differs'));
		expect(differing).toHaveLength(2);
		expect(rows.slice(0, 2)).toEqual(differing);
	});

	it('reads Not asked, with no marks, when sexual violence is not Present', () => {
		render(ReportAnswers, {
			answers: { ...NONE, sexualPresent: 'none', sexHarOnScrn: null, rapeOnScreen: null },
			um: UM
		});
		expect(screen.getAllByText('Not asked')).toHaveLength(8);
		expect(screen.queryByText('Differs')).toBeNull();
	});

	it('reads Not sure for an unanswered flag when sexual violence is Present', () => {
		render(ReportAnswers, { answers: { ...NONE }, um: UM });
		expect(screen.queryByText('Not asked')).toBeNull();
		expect(screen.getAllByText('Not sure').length).toBeGreaterThan(0);
	});
});

describe('the open title view', () => {
	const flagged: FlaggedTitle = {
		titleId: 't1',
		title: { kind: 'movie', tmdbId: 348, name: 'Alien' },
		flags: [
			{
				id: 'f1',
				note: 'Too low',
				reporter: 'bo',
				reporterId: 'u1',
				createdAt: '2026-11-10T10:00:00Z'
			},
			{
				id: 'f2',
				note: null,
				reporter: null,
				reporterId: 'u2',
				createdAt: '2026-11-11T10:00:00Z'
			}
		]
	};
	const open = { id: 't1', kind: 'movie' as const, tmdbId: 348, name: 'Alien', reports: [] };
	const me = { id: 'mod', role: 'moderator' };

	function mountPanel(flags: FlaggedTitle[] = [flagged]) {
		return render(CommunityReportsPanel, {
			held: [],
			flagged: flags,
			openTitle: open,
			titleId: 't1',
			me
		});
	}

	it('heads the flags card like the other sections and shows an account for a removed reporter', () => {
		mountPanel();
		expect(screen.getByRole('heading', { name: 'Counts look wrong' }).className).toContain(
			'heading'
		);
		expect(screen.getByText('Reported by bo')).toBeTruthy();
		expect(screen.getByText('Reported by An account')).toBeTruthy();
		expect(screen.queryByText('A removed account')).toBeNull();
	});

	it('links back to the community-reports list, 44px on a coarse pointer', () => {
		mountPanel();
		const back = screen.getByRole('link', { name: /Back to community reports/ });
		expect(back.getAttribute('href')).toBe('?tab=reports');
		expect(back.querySelector('.ri-arrow-left-s-line')).not.toBeNull();
	});

	it('makes each flag its own focus root, and sends the focus to the heading when none is left', async () => {
		mountPanel();
		const items = screen.getAllByRole('listitem').filter((li) => li.matches('li[tabindex="-1"]'));
		expect(items.length).toBeGreaterThanOrEqual(2);
		form.update = async () => {
			document.querySelectorAll('li[tabindex="-1"]').forEach((li) => li.remove());
		};
		await fireEvent.submit(
			screen.getAllByRole('button', { name: 'Resolve' })[0].closest('form') as HTMLFormElement
		);
		await waitFor(() => expect(document.activeElement?.id).toBe('open-title'));
	});

	it('confirms a resolved or dismissed flag with a toast', async () => {
		mountPanel();
		form.result = { type: 'success', data: { id: 'f1', done: 'resolveFlag' } };
		await fireEvent.submit(
			screen.getAllByRole('button', { name: 'Resolve' })[0].closest('form') as HTMLFormElement
		);
		await waitFor(() => expect(shown()).toEqual(['success: Marked resolved.']));
		form.result = { type: 'success', data: { id: 'f2', done: 'dismissFlag' } };
		await fireEvent.submit(
			screen.getAllByRole('button', { name: 'Dismiss' })[1].closest('form') as HTMLFormElement
		);
		await waitFor(() =>
			expect(shown()).toEqual(['success: Marked resolved.', 'success: Dismissed.'])
		);
	});

	it('hides the buttons of a moderator’s own flag only; an administrator keeps theirs', () => {
		const own = { ...flagged.flags[0], id: 'f3', reporterId: 'mod' };
		const props = { held: [], openTitle: open, titleId: 't1' };
		const { unmount } = render(CommunityReportsPanel, {
			...props,
			flagged: [{ ...flagged, flags: [own] }],
			me
		});
		expect(screen.queryByRole('button', { name: 'Resolve' })).toBeNull();
		expect(screen.queryByRole('button', { name: 'Dismiss' })).toBeNull();
		expect(
			screen.getByText('Another moderator or an administrator closes this flag.')
		).toBeTruthy();
		unmount();
		render(CommunityReportsPanel, {
			...props,
			flagged: [{ ...flagged, flags: [own, flagged.flags[1]] }],
			me: { id: 'mod', role: 'administrator' }
		});
		expect(screen.getAllByRole('button', { name: 'Resolve' })).toHaveLength(2);
	});

	it('shows no actions for a report of an administrator', () => {
		const admin = titleReport({ account: account({ role: 'administrator' }) });
		render(CommunityReportsPanel, {
			held: [],
			flagged: [],
			openTitle: { ...open, reports: [admin] },
			titleId: 't1',
			me
		});
		expect(screen.queryByRole('button', { name: 'Mute account' })).toBeNull();
	});
});

describe('the action log sentences', () => {
	const actor = {
		id: 'mod',
		username: 'mod',
		avatarKey: null,
		role: 'moderator' as const,
		displayName: 'mod'
	};
	const target = {
		...actor,
		id: 'u1',
		username: 'anna',
		role: 'user' as const,
		displayName: 'anna'
	};
	const entry = (over: Partial<RecentAction>): RecentAction => ({
		id: 'a',
		action: 'approve_report',
		reason: null,
		createdAt: '2026-11-03T10:00:00.000Z',
		actor,
		targetUser: target,
		muteHours: null,
		commentBody: null,
		commentId: null,
		commentStatus: null,
		commentEditedAt: null,
		title: { id: 't1', kind: 'movie', tmdbId: 348, name: 'Alien' },
		...over
	});
	const mountEntry = (e: RecentAction) => {
		const list = document.body.appendChild(document.createElement('ul'));
		return render(RecentActionRow, { props: { entry: e }, target: list });
	};

	it.each([
		['approve_report', /counted a community report by\s*anna/],
		['reject_report', /rejected a community report by\s*anna/],
		['reject_account_reports', /rejected every community report by\s*anna/]
	] as const)('%s names the account, and the title where it has one', (action, text) => {
		mountEntry(entry(action === 'reject_account_reports' ? { action, title: null } : { action }));
		expect(document.body.textContent?.replace(/\s+/g, ' ')).toMatch(text);
		if (action !== 'reject_account_reports') {
			expect(screen.getByRole('link', { name: 'Alien' }).getAttribute('href')).toBe('?title=t1');
		} else {
			expect(screen.queryByText(/^On/)).toBeNull();
		}
	});

	it.each([
		['resolve_count_flag', 'resolved Counts look wrong on'],
		['dismiss_count_flag', 'dismissed Counts look wrong on']
	] as const)('%s ends on the title', (action, verb) => {
		mountEntry(entry({ action, targetUser: null }));
		const line = document.body.textContent?.replace(/\s+/g, ' ') ?? '';
		expect(line).toMatch(new RegExp(`${verb}\\s*Alien`));
		expect(screen.getByRole('link', { name: 'Alien' }).getAttribute('href')).toBe('?title=t1');
	});

	it('keeps a comment action’s title link on the title page', () => {
		mountEntry(entry({ action: 'hide', targetUser: null, commentId: 'c1' }));
		expect(screen.getByRole('link', { name: 'Alien' }).getAttribute('href')).toBe('/movie/348');
	});
});

describe('the account actions group', () => {
	it('renders nothing for an administrator on themselves with no reports to reject', () => {
		mountRow(titleReport({ account: account({ reportCount: 0 }) }), true, false);
		expect(screen.queryByText('Account')).toBeNull();
	});
});
