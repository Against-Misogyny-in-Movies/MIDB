import { cleanup, fireEvent, render, screen } from '@testing-library/svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ModerationItem, RecentAction } from '#lib/media/types/moderation.ts';

vi.mock('$app/forms', () => ({ enhance: () => ({ destroy() {} }) }));

const { default: ModerationItemRow } = await import('../moderationItem.svelte');
const { default: RecentActionRow } = await import('../recentActionRow.svelte');

const AUTHOR = {
	id: 'u1',
	username: 'anna',
	avatarKey: null,
	role: 'user' as const,
	displayName: 'anna'
};

function item(over: Partial<ModerationItem> = {}): ModerationItem {
	return {
		comment: {
			id: 'c1',
			parentId: null,
			rootId: null,
			body: 'A comment under review',
			status: 'pending',
			moderationSource: null,
			moderationReason: null,
			score: 0,
			replyCount: 0,
			createdAt: '2026-11-01T10:00:00.000Z',
			editedAt: null
		},
		author: AUTHOR,
		title: { kind: 'movie', tmdbId: 348, name: 'Alien' },
		aiCategories: [],
		reports: [],
		authorCommentCount: 4,
		...over
	};
}

afterEach(cleanup);

function mount(
	over: Partial<ModerationItem> = {},
	extra: { canActOnAuthor?: boolean; outcome?: never } = {}
) {
	const list = document.body.appendChild(document.createElement('ul'));
	return render(ModerationItemRow, {
		props: { item: item(over), outcome: null, canActOnAuthor: true, ...extra },
		target: list
	});
}

describe('ModerationItem', () => {
	it('shows the comment, its title link and the author’s history count', () => {
		mount();
		expect(screen.getByText('A comment under review')).toBeTruthy();
		expect(screen.getByRole('link', { name: 'Alien' }).getAttribute('href')).toBe('/movie/348');
		expect(screen.getByText('4 comments in all')).toBeTruthy();
	});

	it('shows no category list until the classifier supplied categories', () => {
		mount();
		expect(screen.queryByLabelText('Categories from the automatic check')).toBeNull();
		cleanup();
		mount({ aiCategories: ['misogyny', 'slur'] });
		expect(screen.getByLabelText('Categories from the automatic check').textContent).toMatch(
			/misogyny.*slur/
		);
	});

	it('lists each open report with its reason and note', () => {
		mount({
			reports: [
				{ reason: 'spam', note: 'An advert', createdAt: '2026-11-02T10:00:00.000Z' },
				{ reason: 'hate', note: null, createdAt: '2026-11-02T11:00:00.000Z' }
			]
		});
		expect(screen.getByText('2 open reports')).toBeTruthy();
		expect(screen.getByText('Spam')).toBeTruthy();
		expect(screen.getByText('An advert')).toBeTruthy();
		expect(screen.getByText('Hate or bigotry')).toBeTruthy();
		expect(screen.getByRole('button', { name: 'Dismiss reports' })).toBeTruthy();
	});

	it('offers Approve on a pending comment only, and Dismiss only with reports', () => {
		mount();
		expect(screen.getByRole('button', { name: 'Approve' })).toBeTruthy();
		expect(screen.queryByRole('button', { name: 'Dismiss reports' })).toBeNull();
		cleanup();
		mount({ comment: { ...item().comment, status: 'published' } });
		expect(screen.queryByRole('button', { name: 'Approve' })).toBeNull();
	});

	it('hides the mute and ban buttons for an account the role cannot act on', () => {
		mount({}, { canActOnAuthor: false });
		expect(screen.queryByRole('button', { name: 'Mute author' })).toBeNull();
		expect(screen.queryByRole('button', { name: 'Ban author' })).toBeNull();
		expect(screen.getByRole('button', { name: 'Reject' })).toBeTruthy();
	});

	it('asks for a confirmation that names the consequence of a ban', async () => {
		mount();
		await fireEvent.click(screen.getByRole('button', { name: 'Ban author' }));
		expect(screen.getByText(/Its sessions end, it cannot sign in again/)).toBeTruthy();
		expect(screen.getByText(/no way to undo a ban/)).toBeTruthy();
		expect(screen.getByRole('button', { name: 'Ban account' })).toBeTruthy();
		await fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
		expect(screen.queryByRole('button', { name: 'Ban account' })).toBeNull();
	});

	it('names what a reject does to the author before it is sent', async () => {
		mount();
		await fireEvent.click(screen.getByRole('button', { name: 'Reject' }));
		expect(screen.getByText(/the author sees it as rejected with the reason/)).toBeTruthy();
		const form = screen.getByRole('button', { name: 'Reject comment' }).closest('form')!;
		expect(form.getAttribute('action')).toBe('?/reject');
		expect((form.querySelector('[name=id]') as HTMLInputElement).value).toBe('c1');
	});

	it('offers a listed mute length and posts the author id', async () => {
		mount();
		await fireEvent.click(screen.getByRole('button', { name: 'Mute author' }));
		const select = screen.getByLabelText('Length');
		expect([...select.querySelectorAll('option')].map((o) => o.textContent)).toEqual([
			'1 day',
			'7 days',
			'30 days'
		]);
		const form = select.closest('form')!;
		expect((form.querySelector('[name=userId]') as HTMLInputElement).value).toBe('u1');
	});

	it('shows a refusal beside the row it concerns, and not on another row', () => {
		const list = document.body.appendChild(document.createElement('ul'));
		render(ModerationItemRow, {
			props: {
				item: item(),
				outcome: { id: 'c1', error: 'The comment is no longer in a state this action applies to.' },
				canActOnAuthor: true
			},
			target: list
		});
		expect(screen.getByRole('alert').textContent).toMatch(/no longer in a state/);
		cleanup();
		const other = document.body.appendChild(document.createElement('ul'));
		render(ModerationItemRow, {
			props: { item: item(), outcome: { id: 'other', error: 'x' }, canActOnAuthor: true },
			target: other
		});
		expect(screen.queryByRole('alert')).toBeNull();
	});
});

describe('RecentActionRow', () => {
	const entry = (over: Partial<RecentAction> = {}): RecentAction => ({
		id: 'a1',
		action: 'reject',
		reason: 'Slur',
		createdAt: '2026-11-03T10:00:00.000Z',
		actor: { ...AUTHOR, id: 'mod', displayName: 'mod' },
		targetUser: null,
		commentBody: 'The rejected text',
		commentId: 'c1',
		commentStatus: 'rejected',
		...over
	});

	function mountEntry(e: RecentAction) {
		const list = document.body.appendChild(document.createElement('ul'));
		return render(RecentActionRow, { props: { entry: e, outcome: null }, target: list });
	}

	it('reads as who did what to which comment, with the reason', () => {
		mountEntry(entry());
		expect(screen.getByText(/rejected a comment/)).toBeTruthy();
		expect(screen.getByText('The rejected text')).toBeTruthy();
		expect(screen.getByText('Reason: Slur')).toBeTruthy();
	});

	it('offers Restore for a hide or reject that still stands, and for nothing else', () => {
		mountEntry(entry());
		expect(screen.getByRole('button', { name: 'Restore comment' })).toBeTruthy();
		cleanup();
		mountEntry(entry({ commentStatus: 'published' }));
		expect(screen.queryByRole('button', { name: 'Restore comment' })).toBeNull();
		cleanup();
		mountEntry(entry({ action: 'approve', commentStatus: 'published' }));
		expect(screen.queryByRole('button', { name: 'Restore comment' })).toBeNull();
	});

	it('names the account of a mute or a ban', () => {
		mountEntry(
			entry({
				action: 'ban',
				commentId: null,
				commentBody: null,
				commentStatus: null,
				targetUser: AUTHOR
			})
		);
		expect(screen.getByText(/banned/)).toBeTruthy();
		expect(screen.getByText('anna')).toBeTruthy();
	});
});
