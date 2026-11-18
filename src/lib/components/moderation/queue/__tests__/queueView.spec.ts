import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ModerationItem } from '#lib/media/types/moderation.ts';

vi.mock('$app/forms', () => ({ enhance: () => ({ destroy() {} }) }));

const { default: QueueView } = await import('../queueView.svelte');
const { moderationPrefs } = await import('#lib/media/utils/moderationPrefs.svelte.js');

const ME = { id: 'mod', role: 'moderator' };

function item(id: string, over: Partial<ModerationItem> = {}): ModerationItem {
	return {
		comment: {
			id,
			parentId: null,
			rootId: null,
			body: `Body of ${id}`,
			status: 'pending',
			moderationSource: null,
			moderationReason: null,
			moderationRule: null,
			score: 0,
			replyCount: 0,
			createdAt: '2026-11-01T10:00:00.000Z',
			editedAt: null
		},
		author: {
			id: `u-${id}`,
			username: `user_${id}`,
			avatarKey: null,
			role: 'user',
			displayName: id
		},
		title: { kind: 'movie', tmdbId: 348, name: 'Alien' },
		aiCategories: [],
		severity: null,
		severe: false,
		parent: null,
		reports: [],
		authorCommentCount: 3,
		authorMutedUntil: null,
		authorBanned: false,
		authorMutedByModerator: false,
		...over
	};
}

const page = (...items: ModerationItem[]) => ({ items, nextCursor: null });

function mount(items: ModerationItem[]) {
	return render(QueueView, {
		page: page(...items),
		queue: 'pending',
		me: ME,
		empty: 'No comments are waiting for review.'
	});
}

const row = (id: string) => document.getElementById(`row-${id}`) as HTMLElement;
/** The list item that holds the open item's panel, and the panel itself. */
const slot = () => document.querySelector('li.panel') as HTMLElement;
const panel = () => slot().firstElementChild as HTMLElement;

afterEach(() => {
	cleanup();
	moderationPrefs.collapseSevere = true;
	localStorage.clear();
});

describe('selecting an item', () => {
	it('opens the first item on load, with its panel right after its row', () => {
		mount([item('c1'), item('c2'), item('c3')]);
		expect(row('c1').getAttribute('aria-current')).toBe('true');
		expect(row('c2').getAttribute('aria-current')).toBeNull();
		expect(panel().id).toBe('comment-c1');
		expect(row('c1').closest('li')?.nextElementSibling).toBe(slot());
	});

	it('moves the panel under the row that is chosen, and keeps one panel', async () => {
		mount([item('c1'), item('c2'), item('c3')]);
		await fireEvent.click(row('c3'));
		expect(document.querySelectorAll('li.panel')).toHaveLength(1);
		expect(panel().id).toBe('comment-c3');
		expect(row('c3').closest('li')?.nextElementSibling).toBe(slot());
		expect(row('c3').getAttribute('aria-current')).toBe('true');
		expect(row('c1').getAttribute('aria-current')).toBeNull();
	});

	it('opens the item that takes the removed one’s place when an action removes it', async () => {
		const { rerender } = mount([item('c1'), item('c2'), item('c3')]);
		await fireEvent.click(row('c2'));
		await rerender({ page: page(item('c1'), item('c3')) } as never);
		await waitFor(() => expect(panel().id).toBe('comment-c3'));
		expect(row('c3').getAttribute('aria-current')).toBe('true');
	});

	it('opens the last item when the removed one was last', async () => {
		const { rerender } = mount([item('c1'), item('c2')]);
		await fireEvent.click(row('c2'));
		await rerender({ page: page(item('c1')) } as never);
		await waitFor(() => expect(panel().id).toBe('comment-c1'));
	});

	it('says what is empty when the last row leaves', async () => {
		const { rerender } = mount([item('c1')]);
		await rerender({ page: page() } as never);
		expect(screen.getByText('No comments are waiting for review.')).toBeTruthy();
	});
});

describe('a row', () => {
	it('shows the severity, the open reports, the title, the date and the start of the text', () => {
		mount([
			item('c1', {
				severity: 1,
				reports: [
					{ reason: 'spam', note: null, createdAt: '2026-11-02T10:00:00.000Z', reporter: 'bo' },
					{ reason: 'hate', note: null, createdAt: '2026-11-02T11:00:00.000Z', reporter: 'cy' }
				]
			})
		]);
		const r = within(row('c1'));
		expect(r.getByText('Severity 1')).toBeTruthy();
		expect(r.getByText('2 open reports')).toBeTruthy();
		expect(r.getByText('Alien')).toBeTruthy();
		expect(r.getByText('01/11/2026')).toBeTruthy();
		expect(r.getByText('Body of c1')).toBeTruthy();
	});
});

describe('the panel', () => {
	it('shows the thread context: the parent’s author and start, and the reply count', () => {
		mount([
			item('c1', {
				comment: { ...item('c1').comment, parentId: 'p1', replyCount: 2 },
				parent: { author: 'lorde_8841', excerpt: 'The ending only works if the film believes her.' }
			})
		]);
		const p = within(panel());
		expect(p.getByText('lorde_8841')).toBeTruthy();
		expect(panel().textContent).toContain('The ending only works if the film believes her.');
		expect(p.getByText('2 replies')).toBeTruthy();
	});

	it('names a deleted parent without an excerpt, and shows no thread for a top-level comment', () => {
		mount([item('c1', { parent: { author: 'lorde_8841', excerpt: null } })]);
		expect(panel().textContent).toContain('a deleted comment');
		cleanup();
		mount([item('c1')]);
		expect(panel().textContent).not.toContain('In reply to');
		expect(within(panel()).queryByText(/repl(y|ies)$/)).toBeNull();
	});

	it('shows the author’s standing, the categories, the open reports and then the actions', () => {
		mount([
			item('c1', {
				authorMutedUntil: '2026-12-01T10:00:00.000Z',
				aiCategories: ['misogyny'],
				reports: [
					{
						reason: 'spam',
						note: 'An advert',
						createdAt: '2026-11-02T10:00:00.000Z',
						reporter: 'bo'
					}
				]
			})
		]);
		const text = (panel().textContent ?? '').replace(/\s+/g, ' ');
		const at = (needle: string) => text.indexOf(needle);
		expect(at('3 comments in all')).toBeGreaterThan(-1);
		expect(text).toContain('Muted until');
		expect(at('Body of c1')).toBeLessThan(at('Misogyny'));
		expect(at('Misogyny')).toBeLessThan(at('1 open report'));
		expect(at('1 open report')).toBeLessThan(at('Approve'));
	});
});

describe('collapsed severe comments', () => {
	const severe = () =>
		item('c1', { severity: 3, severe: true, aiCategories: ['threat', 'misogyny'] });

	it('starts collapsed in the row and the panel, with the categories showing', () => {
		mount([severe()]);
		expect(within(row('c1')).queryByText('Body of c1')).toBeNull();
		expect(row('c1').textContent).toContain('Comment collapsed: Threat, Misogyny.');
		expect(within(panel()).queryByText('Body of c1')).toBeNull();
		expect(within(panel()).getByLabelText('Categories from the automatic check')).toBeTruthy();
		expect(within(panel()).getByRole('button', { name: 'Show comment' })).toBeTruthy();
	});

	it('shows the text in the row and the panel on Show comment, and collapses again on Hide comment', async () => {
		mount([severe()]);
		await fireEvent.click(within(panel()).getByRole('button', { name: 'Show comment' }));
		expect(within(row('c1')).getByText('Body of c1')).toBeTruthy();
		expect(within(panel()).getByText('Body of c1')).toBeTruthy();
		await fireEvent.click(within(panel()).getByRole('button', { name: 'Hide comment' }));
		expect(within(panel()).queryByText('Body of c1')).toBeNull();
		expect(within(row('c1')).queryByText('Body of c1')).toBeNull();
	});

	it('keeps a revealed comment revealed when another item is opened and this one again', async () => {
		mount([severe(), item('c2')]);
		await fireEvent.click(within(panel()).getByRole('button', { name: 'Show comment' }));
		await fireEvent.click(row('c2'));
		await fireEvent.click(row('c1'));
		expect(within(panel()).getByText('Body of c1')).toBeTruthy();
	});

	it('shows a comment below the severity as it is, with no Show comment button', () => {
		mount([item('c1', { severity: 1, severe: false })]);
		expect(within(panel()).getByText('Body of c1')).toBeTruthy();
		expect(screen.queryByRole('button', { name: /Show comment|Hide comment/ })).toBeNull();
	});

	it('shows every comment as it is when the setting is off', () => {
		moderationPrefs.setCollapseSevere(false);
		mount([severe()]);
		expect(within(row('c1')).getByText('Body of c1')).toBeTruthy();
		expect(within(panel()).getByText('Body of c1')).toBeTruthy();
		expect(screen.queryByRole('button', { name: /Show comment|Hide comment/ })).toBeNull();
	});
});
