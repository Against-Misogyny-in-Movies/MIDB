import { cleanup, fireEvent, render, screen } from '@testing-library/svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ModerationItem, RecentAction, ReportAccount } from '#lib/media/types/moderation.ts';

vi.mock('$app/forms', () => ({
	enhance: (node: HTMLFormElement) => {
		const onSubmit = (event: Event) => event.preventDefault();
		node.addEventListener('submit', onSubmit);
		return { destroy: () => node.removeEventListener('submit', onSubmit) };
	}
}));

const { default: ModerationItemRow } = await import('../moderationItem.svelte');
const { default: RecentActionRow } = await import('../recentActionRow.svelte');
const { default: ReportAccountActions } = await import('../reportAccountActions.svelte');
const { default: CountFlagItem } = await import('../countFlagItem.svelte');

afterEach(cleanup);

const MOD = { id: 'mod', role: 'moderator' };
const ADMIN = { id: 'admin', role: 'administrator' };
const AUTHOR: ModerationItem['author'] = {
	id: 'u1',
	username: 'anna',
	avatarKey: null,
	role: 'user',
	displayName: 'anna'
};

const item = (over: Partial<ModerationItem> = {}): ModerationItem => ({
	comment: {
		id: 'c1',
		parentId: null,
		rootId: null,
		body: 'A comment',
		status: 'published',
		moderationSource: null,
		moderationReason: null,
		moderationRule: null,
		score: 0,
		replyCount: 0,
		createdAt: '2026-11-01T10:00:00.000Z',
		editedAt: '2026-11-02T10:00:00.000Z'
	},
	author: AUTHOR,
	title: { kind: 'movie', tmdbId: 348, name: 'Alien' },
	aiCategories: [],
	severity: null,
	severe: false,
	parent: null,
	reports: [],
	authorCommentCount: 2,
	authorMutedUntil: null,
	authorBanned: false,
	authorMutedByModerator: false,
	...over
});

function mountItem(over: Partial<ModerationItem>, me = MOD) {
	const list = document.body.appendChild(document.createElement('ul'));
	return render(ModerationItemRow, { props: { item: item(over), me }, target: list });
}

const button = (name: string) => screen.queryByRole('button', { name });

describe('ModerationItem offers the action that fits the state', () => {
	it('offers Restore, not Hide and Reject, on a hidden or rejected comment', () => {
		for (const status of ['hidden', 'rejected'] as const) {
			mountItem({ comment: { ...item().comment, status } });
			expect(button('Restore comment')).toBeTruthy();
			expect(button('Hide')).toBeNull();
			expect(button('Reject')).toBeNull();
			cleanup();
		}
	});

	it('posts the restore with the comment id and the viewed editedAt', () => {
		mountItem({ comment: { ...item().comment, status: 'hidden' } });
		const form = button('Restore comment')?.closest('form') as HTMLFormElement;
		expect(form.getAttribute('action')).toBe('?/restore');
		expect((form.querySelector('[name=id]') as HTMLInputElement).value).toBe('c1');
		expect((form.querySelector('[name=editedAt]') as HTMLInputElement).value).not.toBe('');
	});

	it('offers Hide and Reject, not Restore, on a published or pending comment', () => {
		mountItem({});
		expect(button('Hide')).toBeTruthy();
		expect(button('Restore comment')).toBeNull();
	});

	it('offers neither Hide, Reject nor Restore on a deleted comment', () => {
		mountItem({ comment: { ...item().comment, status: 'deleted' } });
		expect(button('Hide')).toBeNull();
		expect(button('Restore comment')).toBeNull();
	});

	it('offers End mute instead of Mute account for a muted account, and keeps Ban account', () => {
		mountItem({ authorMutedUntil: '2026-12-01T10:00:00.000Z' }, ADMIN);
		expect(button('End mute')).toBeTruthy();
		expect(button('Mute account')).toBeNull();
		expect(button('Ban account')).toBeTruthy();
	});

	it('gives a moderator End mute only on a mute a moderator set', () => {
		mountItem({ authorMutedUntil: '2026-12-01T10:00:00.000Z', authorMutedByModerator: false });
		expect(button('End mute')).toBeNull();
		expect(button('Mute account')).toBeNull();
		cleanup();
		mountItem({ authorMutedUntil: '2026-12-01T10:00:00.000Z', authorMutedByModerator: true });
		expect(button('End mute')).toBeTruthy();
	});

	it('offers Lift ban instead of Mute and Ban to an administrator, and nothing to a moderator', () => {
		mountItem({ authorBanned: true }, ADMIN);
		expect(button('Lift ban')).toBeTruthy();
		expect(button('Mute account')).toBeNull();
		expect(button('Ban account')).toBeNull();
		expect(screen.getByText('Banned')).toBeTruthy();
		cleanup();
		mountItem({ authorBanned: true });
		expect(button('Lift ban')).toBeNull();
		expect(button('Mute account')).toBeNull();
		expect(button('Ban account')).toBeNull();
	});

	it('opens a plate that says what Lift ban does not undo and posts to ?/unban', async () => {
		mountItem({ authorBanned: true }, ADMIN);
		await fireEvent.click(screen.getByRole('button', { name: 'Lift ban' }));
		expect(screen.getByText(/stay hidden and its removed votes stay removed/)).toBeTruthy();
		const form = screen
			.getAllByRole('button', { name: 'Lift ban' })
			.map((b) => b.closest('form'))
			.find((f) => f) as HTMLFormElement;
		expect(form.getAttribute('action')).toBe('?/unban');
		expect((form.querySelector('[name=userId]') as HTMLInputElement).value).toBe('u1');
		expect(screen.getByLabelText(/Note, kept in the log \(optional\)/)).toBeTruthy();
	});

	it('opens a plate for End mute that posts to ?/unmute', async () => {
		mountItem({ authorMutedUntil: '2026-12-01T10:00:00.000Z', authorMutedByModerator: true });
		await fireEvent.click(screen.getByRole('button', { name: 'End mute' }));
		const form = screen
			.getAllByRole('button', { name: 'End mute' })
			.map((b) => b.closest('form'))
			.find((f) => f) as HTMLFormElement;
		expect(form.getAttribute('action')).toBe('?/unmute');
	});
});

const account = (over: Partial<ReportAccount> = {}): ReportAccount => ({
	userId: 'u1',
	username: 'anna',
	createdAt: '2026-01-01T00:00:00.000Z',
	reportCount: 0,
	commentCount: 1,
	role: 'user',
	countsFrom: '2026-01-08T00:00:00.000Z',
	restricted: null,
	mutedByModerator: false,
	...over
});

function mountAccount(over: Partial<ReportAccount>, staffRole: string) {
	return render(ReportAccountActions, {
		account: account(over),
		canAct: true,
		canRestrict: true,
		staffRole
	});
}

describe('ReportAccountActions offers the action that fits the account', () => {
	it('offers Mute and Ban account on an account with no restriction', () => {
		mountAccount({}, 'moderator');
		expect(button('Mute account')).toBeTruthy();
		expect(button('Ban account')).toBeTruthy();
		expect(button('End mute')).toBeNull();
		expect(button('Lift ban')).toBeNull();
	});

	it('offers End mute for a muted account to an administrator, and to a moderator only for their own mute', () => {
		mountAccount({ restricted: 'muted' }, 'administrator');
		expect(button('End mute')).toBeTruthy();
		expect(button('Mute account')).toBeNull();
		cleanup();
		mountAccount({ restricted: 'muted' }, 'moderator');
		expect(button('End mute')).toBeNull();
		cleanup();
		mountAccount({ restricted: 'muted', mutedByModerator: true }, 'moderator');
		expect(button('End mute')).toBeTruthy();
	});

	it('offers Lift ban for a banned account to an administrator only', () => {
		mountAccount({ restricted: 'banned' }, 'administrator');
		expect(button('Lift ban')).toBeTruthy();
		expect(button('Ban account')).toBeNull();
		expect(button('Mute account')).toBeNull();
		cleanup();
		mountAccount({ restricted: 'banned' }, 'moderator');
		expect(button('Lift ban')).toBeNull();
	});
});

const entry = (over: Partial<RecentAction>): RecentAction => ({
	id: 'a1',
	action: 'mute',
	reason: null,
	rule: null,
	createdAt: '2026-11-03T10:00:00.000Z',
	actor: { ...AUTHOR, id: 'mod', displayName: 'mod', role: 'moderator' },
	targetUser: AUTHOR,
	muteHours: 24,
	commentBody: null,
	commentId: null,
	commentStatus: null,
	commentEditedAt: null,
	inForce: { byModerator: true },
	flag: null,
	title: null,
	...over
});

function mountEntry(e: RecentAction, me = MOD) {
	const list = document.body.appendChild(document.createElement('ul'));
	return render(RecentActionRow, { props: { entry: e, me }, target: list });
}

describe('RecentActionRow offers the reversal that is still possible', () => {
	it('offers End mute on a mute in force, to an administrator and to a moderator for a moderator’s mute', () => {
		mountEntry(entry({}), ADMIN);
		expect(button('End mute')).toBeTruthy();
		cleanup();
		mountEntry(entry({}));
		expect(button('End mute')).toBeTruthy();
		cleanup();
		mountEntry(entry({ inForce: { byModerator: false } }));
		expect(button('End mute')).toBeNull();
	});

	it('offers no End mute on a mute that is over or replaced', () => {
		mountEntry(entry({ inForce: null }), ADMIN);
		expect(button('End mute')).toBeNull();
	});

	it('offers Lift ban on a ban in force to an administrator only', () => {
		mountEntry(entry({ action: 'ban', muteHours: null, inForce: { byModerator: false } }), ADMIN);
		expect(button('Lift ban')).toBeTruthy();
		cleanup();
		mountEntry(entry({ action: 'ban', muteHours: null, inForce: { byModerator: false } }));
		expect(button('Lift ban')).toBeNull();
		cleanup();
		mountEntry(entry({ action: 'ban', muteHours: null, inForce: null }), ADMIN);
		expect(button('Lift ban')).toBeNull();
	});

	it('reads the new actions with their own verbs', () => {
		mountEntry(entry({ action: 'unmute', muteHours: null, inForce: null }));
		expect(screen.getByText(/ended the mute of/)).toBeTruthy();
		cleanup();
		mountEntry(entry({ action: 'unban', muteHours: null, inForce: null }));
		expect(screen.getByText(/lifted the ban on/)).toBeTruthy();
	});

	it('offers Re-open on a closed flag to whoever may close it', () => {
		const closed = entry({
			action: 'resolve_count_flag',
			muteHours: null,
			inForce: null,
			flag: { id: 'f1', status: 'resolved' },
			title: { id: 't1', kind: 'movie', tmdbId: 348, name: 'Alien' }
		});
		mountEntry(closed);
		const form = button('Re-open')?.closest('form') as HTMLFormElement;
		expect(form.getAttribute('action')).toBe('?/reopenFlag');
		expect((form.querySelector('[name=id]') as HTMLInputElement).value).toBe('f1');
		expect(screen.getByText(/resolved Counts look wrong from/)).toBeTruthy();
		cleanup();
		mountEntry(entry({ ...closed, flag: { id: 'f1', status: 'open' } }));
		expect(button('Re-open')).toBeNull();
		cleanup();
		mountEntry({
			...closed,
			targetUser: { ...AUTHOR, id: 'admin', role: 'administrator' }
		});
		expect(button('Re-open')).toBeNull();
		cleanup();
		mountEntry({ ...closed, targetUser: { ...AUTHOR, id: 'admin', role: 'administrator' } }, ADMIN);
		expect(button('Re-open')).toBeTruthy();
	});
});

describe('CountFlagItem on a closed flag', () => {
	const flag = {
		id: 'f1',
		status: 'dismissed' as const,
		note: null,
		reporter: 'anna',
		reporterId: 'u1',
		reporterRole: 'user',
		createdAt: '2026-11-01T10:00:00.000Z'
	};

	it('says how it closed and offers Re-open, not Resolve and Dismiss', () => {
		const list = document.body.appendChild(document.createElement('ul'));
		render(CountFlagItem, { props: { flag, canAct: true }, target: list });
		expect(screen.getByText('Dismissed')).toBeTruthy();
		expect(button('Re-open')).toBeTruthy();
		expect(button('Resolve')).toBeNull();
		expect(button('Dismiss')).toBeNull();
	});

	it('offers nothing to someone who may not close it', () => {
		const list = document.body.appendChild(document.createElement('ul'));
		render(CountFlagItem, { props: { flag, canAct: false }, target: list });
		expect(button('Re-open')).toBeNull();
	});
});

describe('RecentActionRow labels', () => {
	const plain = { muteHours: null, inForce: null };

	it('reads an action this build does not know as a plain label', () => {
		mountEntry(entry({ ...plain, action: 'future_action' as RecentAction['action'] }));
		expect(screen.getByText(/acted on/)).toBeTruthy();
		expect(screen.queryByText(/undefined/)).toBeNull();
	});

	it('shows the rule beside the note', () => {
		mountEntry(entry({ ...plain, action: 'reject', rule: 'harassment', reason: 'Slur' }));
		expect(screen.getByText('Rule: Harassment')).toBeTruthy();
		expect(screen.getByText('Reason: Slur')).toBeTruthy();
		cleanup();
		mountEntry(entry({ ...plain, action: 'reject', rule: null, reason: 'Slur' }));
		expect(screen.queryByText(/^Rule:/)).toBeNull();
	});
});
