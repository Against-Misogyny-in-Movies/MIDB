import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/svelte';
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
const { default: BulkBar } = await import('../table/bulkBar.svelte');

afterEach(cleanup);

const ADMIN = { id: 'admin', role: 'administrator' };
const USER: ModerationItem['author'] = {
	id: 'u1',
	username: 'anna',
	avatarKey: null,
	role: 'user',
	displayName: 'anna'
};

const button = (name: string) => screen.getByRole('button', { name });
const plate = () => document.querySelector('form.plate');

/** Every plate the same way: it takes the focus, Escape closes it, and the focus goes back to the button that opened it. */
async function opensAndCloses(opener: string, firstField: () => HTMLElement | null) {
	await fireEvent.click(button(opener));
	expect(plate()).not.toBeNull();
	await waitFor(() => expect(document.activeElement).toBe(firstField()));
	await fireEvent.keyDown(document.activeElement as Element, { key: 'Escape' });
	await waitFor(() => expect(plate()).toBeNull());
	await waitFor(() => expect(document.activeElement).toBe(button(opener)));
	await fireEvent.click(button(opener));
	await fireEvent.click(button('Cancel'));
	await waitFor(() => expect(plate()).toBeNull());
	await waitFor(() => expect(document.activeElement).toBe(button(opener)));
}

describe('every plate takes focus on open and returns it on Cancel or Escape', () => {
	it('on a queue item (hide, then reject)', async () => {
		const list = document.body.appendChild(document.createElement('ul'));
		render(ModerationItemRow, {
			props: {
				item: {
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
						editedAt: null
					},
					author: USER,
					title: { kind: 'movie', tmdbId: 348, name: 'Alien' },
					aiCategories: [],
					severity: null,
					severe: false,
					parent: null,
					reports: [],
					authorCommentCount: 2,
					authorMutedUntil: null,
					authorBanned: false,
					authorMutedByModerator: false
				} satisfies ModerationItem,
				me: ADMIN
			},
			target: list
		});
		await opensAndCloses('Hide', () => screen.getAllByRole('radio')[0]);
		await opensAndCloses('Reject', () => screen.getAllByRole('radio')[0]);
		await opensAndCloses('Mute account', () => screen.getByRole('combobox'));
	});

	it('on an account’s buttons in the community reports', async () => {
		render(ReportAccountActions, {
			account: {
				userId: 'u1',
				username: 'anna',
				createdAt: '2026-01-01T00:00:00.000Z',
				reportCount: 2,
				commentCount: 1,
				role: 'user',
				countsFrom: '2026-01-08T00:00:00.000Z',
				restricted: 'muted',
				mutedByModerator: true
			} satisfies ReportAccount,
			canAct: true,
			canRestrict: true,
			staffRole: 'administrator'
		});
		await opensAndCloses('End mute', () => screen.getByLabelText(/Note, kept in the log/));
		await opensAndCloses('Reject all from this account', () =>
			screen.getByRole('button', { name: /Reject all community reports/ })
		);
	});

	it('on the bulk bar (hide, then reject)', async () => {
		render(BulkBar, { ids: ['a', 'b'], editedAts: {}, onclear: () => {}, fallbackIds: [] });
		await opensAndCloses('Hide', () => screen.getAllByRole('radio')[0]);
		await opensAndCloses('Reject', () => screen.getAllByRole('radio')[0]);
	});

	it('on a log row’s reversal', async () => {
		const list = document.body.appendChild(document.createElement('ul'));
		render(RecentActionRow, {
			props: {
				entry: {
					id: 'a1',
					action: 'ban',
					reason: null,
					rule: null,
					createdAt: '2026-11-03T10:00:00.000Z',
					actor: { ...USER, id: 'admin', displayName: 'admin', role: 'administrator' },
					targetUser: USER,
					muteHours: null,
					commentBody: null,
					commentId: null,
					commentStatus: null,
					commentEditedAt: null,
					inForce: { byModerator: false },
					flag: null,
					title: null
				} satisfies RecentAction,
				me: ADMIN
			},
			target: list
		});
		await opensAndCloses('Lift ban', () => screen.getByLabelText(/Note, kept in the log/));
	});
});
