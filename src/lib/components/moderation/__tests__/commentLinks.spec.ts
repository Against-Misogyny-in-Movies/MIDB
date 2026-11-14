import { cleanup, render, screen, within } from '@testing-library/svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ModerationItem, RecentAction } from '#lib/media/types/moderation.ts';

vi.mock('$app/forms', () => ({ enhance: () => ({ destroy: () => {} }) }));
vi.mock('$app/navigation', () => ({ goto: vi.fn() }));

const { default: ModerationItemRow } = await import('../moderationItem.svelte');
const { default: RecentActionRow } = await import('../recentActionRow.svelte');
const { default: ModerationTable } = await import('../table/moderationTable.svelte');

afterEach(cleanup);

const AUTHOR = {
	id: 'u1',
	username: 'anna',
	avatarKey: null,
	role: 'user' as const,
	displayName: 'anna'
};
const MOD = { id: 'mod', role: 'moderator' };
const TITLE = { kind: 'movie' as const, tmdbId: 348, name: 'Alien' };
const COMMENT = {
	id: 'c1',
	parentId: null,
	rootId: null,
	body: 'A comment',
	status: 'pending' as const,
	moderationSource: null,
	moderationReason: null,
	score: 0,
	replyCount: 0,
	createdAt: '2026-11-01T10:00:00.000Z',
	editedAt: null
};
const HREF = '/movie/348#comment-c1';

function inList<T>(component: T, props: Record<string, unknown>) {
	const list = document.body.appendChild(document.createElement('ul'));
	return render(component as never, { props, target: list } as never);
}

describe('links to a comment from the moderation views', () => {
	it('links a moderation item to the comment with View comment, not its date', () => {
		const item: ModerationItem = {
			comment: COMMENT,
			author: AUTHOR,
			title: TITLE,
			aiCategories: [],
			reports: [],
			authorCommentCount: 1,
			authorMutedUntil: null
		};
		inList(ModerationItemRow, { item, me: MOD });
		const link = screen.getByRole('link', { name: 'View comment' });
		expect(link.getAttribute('href')).toBe(HREF);
		expect(document.querySelector('time')?.closest('a')).toBeNull();
		expect(document.querySelector('time')?.textContent).toBe('01/11/2026');
		expect(screen.getByRole('link', { name: 'Alien' }).getAttribute('href')).toBe('/movie/348');
	});

	it('adds no comment link when the title has no TMDB id', () => {
		const item = {
			comment: COMMENT,
			author: AUTHOR,
			title: { ...TITLE, tmdbId: null },
			aiCategories: [],
			reports: [],
			authorCommentCount: 1,
			authorMutedUntil: null
		};
		inList(ModerationItemRow, { item, me: MOD });
		expect(document.querySelector('a[href*="#comment-"]')).toBeNull();
		expect(screen.queryByRole('link', { name: /Alien/ })).toBeNull();
	});

	it('links a table row to the comment from its actions, not its Posted date', () => {
		const row = {
			comment: COMMENT,
			author: AUTHOR,
			title: TITLE,
			aiCategories: [],
			reports: [],
			authorCommentCount: 1,
			authorMutedUntil: null,
			severity: null,
			aiFailure: null,
			latestLabel: null
		};
		render(ModerationTable, { rows: [row], me: MOD, selected: [] } as never);
		const posted = document.querySelector('td.posted') as HTMLElement;
		expect(within(posted).queryByRole('link')).toBeNull();
		expect(posted.textContent?.trim()).toBe('01/11/2026');
		const actions = document.querySelector('td.actions') as HTMLElement;
		expect(
			within(actions)
				.getByRole('link', { name: 'View the comment by anna on its title page' })
				.getAttribute('href')
		).toBe(HREF);
	});

	describe('recent actions', () => {
		const entry = (over: Partial<RecentAction> = {}): RecentAction => ({
			id: 'a1',
			action: 'hide',
			reason: null,
			createdAt: '2026-11-03T10:00:00.000Z',
			actor: { ...AUTHOR, id: 'mod', displayName: 'mod' },
			targetUser: null,
			muteHours: null,
			commentBody: 'Hidden text',
			commentId: 'c1',
			commentStatus: 'hidden',
			commentEditedAt: null,
			title: { id: 't1', ...TITLE },
			...over
		});

		it('adds a View comment link when the action names a comment', () => {
			inList(RecentActionRow, { entry: entry() });
			expect(screen.getByRole('link', { name: 'View comment' }).getAttribute('href')).toBe(HREF);
		});

		it('puts the link after the "Edited since" note', () => {
			inList(RecentActionRow, {
				entry: entry({ commentEditedAt: '2026-11-04T10:00:00.000Z' })
			});
			const note = screen.getByText('Edited since');
			const link = screen.getByRole('link', { name: 'View comment' });
			expect(note.compareDocumentPosition(link) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
		});

		it('adds none when the action names no comment, such as a mute', () => {
			inList(RecentActionRow, {
				entry: entry({ action: 'mute', commentId: null, commentBody: null, commentStatus: null })
			});
			expect(screen.queryByRole('link', { name: 'View comment' })).toBeNull();
		});

		it('adds none when the title has no TMDB id', () => {
			inList(RecentActionRow, { entry: entry({ title: { id: 't1', ...TITLE, tmdbId: null } }) });
			expect(screen.queryByRole('link', { name: 'View comment' })).toBeNull();
		});
	});
});
