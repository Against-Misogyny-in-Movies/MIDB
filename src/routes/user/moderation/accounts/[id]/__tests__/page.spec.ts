import { cleanup, render, screen } from '@testing-library/svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('$app/forms', () => ({ enhance: () => ({ destroy() {} }) }));
vi.mock('$app/navigation', () => ({ goto: vi.fn(), invalidateAll: vi.fn() }));

const { default: Page } = await import('../+page.svelte');

afterEach(cleanup);

const USER = {
	id: 'acct',
	username: 'woolf_2210',
	avatarKey: null,
	role: 'user' as const,
	displayName: 'woolf_2210'
};
const ACTION = {
	id: 'a1',
	action: 'mute' as const,
	reason: null,
	rule: 'harassment' as const,
	createdAt: '2026-11-17T10:00:00.000Z',
	actor: {
		id: 'ada',
		username: 'ada_1234',
		avatarKey: null,
		role: 'moderator' as const,
		displayName: 'ada_1234'
	},
	targetUser: USER,
	muteHours: 168,
	commentBody: null,
	commentId: null,
	commentStatus: null,
	commentEditedAt: null,
	inForce: null,
	flag: null,
	title: null
};
const FIGURES = {
	comments: 2,
	hiddenOrRejected: 0,
	openReportsAgainst: 0,
	communityReports: 0,
	communityReportsLive: 0,
	reportsMade: { total: 0, upheld: 0, dismissed: 0 }
};
const LIVE = {
	me: { id: 'mod', role: 'moderator' },
	account: {
		user: USER,
		joinedAt: '2026-09-02T10:00:00.000Z',
		deleted: false,
		mutedUntil: null,
		mutedByModerator: false,
		banned: null,
		figures: FIGURES
	},
	timeline: { items: [ACTION], nextCursor: null },
	notes: { notes: [], total: 0 },
	comments: [],
	reports: [],
	against: []
};

describe('the account page', () => {
	it('shows the standing, the notes, the log and the lists, with a way back to the queues', () => {
		render(Page, { data: LIVE, form: null } as never);
		expect(screen.getByRole('heading', { level: 1, name: 'woolf_2210' })).toBeTruthy();
		expect(screen.getByRole('link', { name: 'Moderation' }).getAttribute('href')).toBe(
			'/user/moderation'
		);
		expect(screen.getByRole('heading', { name: 'Staff notes' })).toBeTruthy();
		expect(screen.getByRole('heading', { name: 'Moderation log' })).toBeTruthy();
		expect(screen.getByRole('tablist', { name: 'Account lists' })).toBeTruthy();
		expect(document.title).toBe('woolf_2210 · Moderation · MIDB');
	});

	it('lists the account’s log through the log row, so a reversal works in place', () => {
		render(Page, { data: LIVE, form: null } as never);
		expect(screen.getByText(/muted/)).toBeTruthy();
		expect(screen.getByText('Rule: Harassment')).toBeTruthy();
		expect(screen.getByRole('link', { name: 'ada_1234' }).getAttribute('href')).toBe(
			'/user/moderation/accounts/ada'
		);
	});

	it('says an empty log and offers no note form to a moderator looking at an administrator', () => {
		render(Page, {
			data: {
				...LIVE,
				account: { ...LIVE.account, user: { ...USER, role: 'administrator' } },
				timeline: { items: [], nextCursor: null }
			},
			form: null
		} as never);
		expect(screen.getByText('No moderation actions on this account.')).toBeTruthy();
		expect(screen.queryByRole('button', { name: 'Add note' })).toBeNull();
	});

	it('shows a deleted account with its log only', () => {
		render(Page, {
			data: {
				...LIVE,
				account: {
					...LIVE.account,
					user: { ...USER, username: null, displayName: 'Account' },
					deleted: true,
					figures: null
				},
				notes: null,
				comments: null,
				reports: null,
				against: null
			},
			form: null
		} as never);
		expect(screen.getByRole('heading', { level: 1, name: 'Deleted account' })).toBeTruthy();
		expect(screen.getByRole('heading', { name: 'Moderation log' })).toBeTruthy();
		expect(screen.queryByRole('heading', { name: 'Staff notes' })).toBeNull();
		expect(screen.queryByRole('tablist')).toBeNull();
		expect(document.title).toBe('Deleted account · Moderation · MIDB');
	});
});
