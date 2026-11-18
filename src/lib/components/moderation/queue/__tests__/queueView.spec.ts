import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ModerationItem } from '#lib/media/types/moderation.ts';

/** The actions the forms posted, in order. */
const posted = vi.hoisted(() => [] as string[]);
const goto = vi.hoisted(() => vi.fn());

vi.mock('$app/navigation', () => ({ goto }));

vi.mock('$app/forms', () => ({
	enhance: (node: HTMLFormElement) => {
		const onSubmit = (event: Event) => {
			event.preventDefault();
			posted.push(node.getAttribute('action') ?? '');
		};
		node.addEventListener('submit', onSubmit);
		return { destroy: () => node.removeEventListener('submit', onSubmit) };
	}
}));

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
		authorHiddenOrRejected: 0,
		authorOpenReportsAgainst: 0,
		authorJoinedAt: '2026-01-05T10:00:00.000Z',
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
	posted.length = 0;
	moderationPrefs.shortcuts = true;
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
					{
						reason: 'spam',
						note: null,
						createdAt: '2026-11-02T10:00:00.000Z',
						reporter: 'bo',
						reporterId: 'rep',
						record: { total: 3, upheld: 2, dismissed: 1 }
					},
					{
						reason: 'hate',
						note: null,
						createdAt: '2026-11-02T11:00:00.000Z',
						reporter: 'cy',
						reporterId: 'rep',
						record: { total: 3, upheld: 2, dismissed: 1 }
					}
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
				parent: {
					author: 'lorde_8841',
					authorId: 'lorde',
					authorUsername: 'lorde_8841',
					excerpt: 'The ending only works if the film believes her.'
				}
			})
		]);
		const p = within(panel());
		expect(p.getByText('lorde_8841')).toBeTruthy();
		expect(panel().textContent).toContain('The ending only works if the film believes her.');
		expect(p.getByText('2 replies')).toBeTruthy();
	});

	it('names a deleted parent without an excerpt, and shows no thread for a top-level comment', () => {
		mount([
			item('c1', {
				parent: {
					author: 'lorde_8841',
					authorId: 'lorde',
					authorUsername: 'lorde_8841',
					excerpt: null
				}
			})
		]);
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
						reporter: 'bo',
						reporterId: 'rep',
						record: { total: 3, upheld: 2, dismissed: 1 }
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
		expect(at('1 open report')).toBeLessThan(at('Approve comment'));
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

	it('shows the text in the row and the panel on Show comment, and collapses again on Collapse comment', async () => {
		mount([severe()]);
		await fireEvent.click(within(panel()).getByRole('button', { name: 'Show comment' }));
		expect(within(row('c1')).getByText('Body of c1')).toBeTruthy();
		expect(within(panel()).getByText('Body of c1')).toBeTruthy();
		await fireEvent.click(within(panel()).getByRole('button', { name: 'Collapse comment' }));
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
		expect(screen.queryByRole('button', { name: /Show comment|Collapse comment/ })).toBeNull();
	});

	it('shows every comment as it is when the setting is off', () => {
		moderationPrefs.setCollapseSevere(false);
		mount([severe()]);
		expect(within(row('c1')).getByText('Body of c1')).toBeTruthy();
		expect(within(panel()).getByText('Body of c1')).toBeTruthy();
		expect(screen.queryByRole('button', { name: /Show comment|Collapse comment/ })).toBeNull();
	});
});

describe('the keyboard path', () => {
	const key = (name: string, init: KeyboardEventInit = {}, target: Element = document.body) =>
		fireEvent.keyDown(target, { key: name, ...init });

	it('moves the open item and the focus to the next and previous row with j and k', async () => {
		mount([item('c1'), item('c2'), item('c3')]);
		await key('j');
		expect(row('c2').getAttribute('aria-current')).toBe('true');
		await waitFor(() => expect(document.activeElement).toBe(row('c2')));
		expect(panel().id).toBe('comment-c2');
		await key('j');
		await waitFor(() => expect(document.activeElement).toBe(row('c3')));
		await key('j');
		expect(row('c3').getAttribute('aria-current')).toBe('true');
		await key('k');
		await waitFor(() => expect(document.activeElement).toBe(row('c2')));
		expect(row('c2').getAttribute('aria-current')).toBe('true');
	});

	it('stays on the first row on k, and on the last on j', async () => {
		mount([item('c1'), item('c2')]);
		await key('k');
		expect(row('c1').getAttribute('aria-current')).toBe('true');
		await key('j');
		await key('j');
		expect(row('c2').getAttribute('aria-current')).toBe('true');
	});

	it('moves the focus into the open item’s panel on Enter from a row or from the page', async () => {
		mount([item('c1'), item('c2')]);
		await key('Enter');
		expect(document.activeElement).toBe(panel());
		row('c2').focus();
		await key('Enter', {}, row('c2'));
		await waitFor(() => expect(panel().id).toBe('comment-c2'));
		await waitFor(() => expect(document.activeElement).toBe(panel()));
	});

	it('leaves Enter on another control to that control', async () => {
		mount([item('c1')]);
		const button = within(panel()).getByRole('button', { name: 'Hide' });
		const event = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });
		button.dispatchEvent(event);
		expect(event.defaultPrevented).toBe(false);
	});

	it('shows a collapsed comment with s, once', async () => {
		mount([item('c1', { severity: 3, severe: true, aiCategories: ['threat'] })]);
		await key('s');
		expect(within(panel()).getByText('Body of c1')).toBeTruthy();
		await key('s');
		expect(within(panel()).getByText('Body of c1')).toBeTruthy();
		expect(within(panel()).getByRole('button', { name: 'Collapse comment' })).toBeTruthy();
	});

	it('approves, dismisses and restores at once, through the visible buttons', async () => {
		mount([
			item('c1', {
				reports: [
					{
						reason: 'spam',
						note: null,
						createdAt: '2026-11-02T10:00:00.000Z',
						reporter: 'bo',
						reporterId: 'rep',
						record: { total: 3, upheld: 2, dismissed: 1 }
					}
				]
			})
		]);
		await key('a');
		await key('d');
		expect(posted).toEqual(['?/approve', '?/dismiss']);
		cleanup();
		posted.length = 0;
		mount([item('c1', { comment: { ...item('c1').comment, status: 'hidden' } })]);
		await key('r');
		expect(posted).toEqual(['?/restore']);
	});

	it('opens the open item’s author account with u, and follows the open item', async () => {
		goto.mockClear();
		mount([item('c1'), item('c2')]);
		await key('u');
		expect(goto).toHaveBeenLastCalledWith('/user/moderation/accounts/u-c1');
		await key('j');
		await key('u');
		expect(goto).toHaveBeenLastCalledWith('/user/moderation/accounts/u-c2');
		expect(posted).toEqual([]);
	});

	it('does not open the account with u in a field or when the setting is off', async () => {
		goto.mockClear();
		mount([item('c1')]);
		await fireEvent.click(within(panel()).getByRole('button', { name: 'Hide' }));
		await key('u', {}, screen.getByLabelText(/Note, shown to the author/));
		moderationPrefs.setShortcuts(false);
		await key('u');
		expect(goto).not.toHaveBeenCalled();
	});

	it('does nothing for a key whose button the item does not have', async () => {
		mount([item('c1')]);
		await key('d');
		await key('r');
		expect(posted).toEqual([]);
	});

	it('opens the rule list for h and x, and never acts on one press', async () => {
		mount([item('c1', { comment: { ...item('c1').comment, status: 'published' } })]);
		await key('h');
		expect(document.querySelector('form.plate')?.getAttribute('action')).toBe('?/hide');
		await key('Escape', {}, document.activeElement as Element);
		await waitFor(() => expect(document.querySelector('form.plate')).toBeNull());
		await key('x');
		expect(document.querySelector('form.plate')?.getAttribute('action')).toBe('?/reject');
		expect(posted).toEqual([]);
	});

	it('does nothing while a field has the focus', async () => {
		mount([item('c1'), item('c2')]);
		await fireEvent.click(within(panel()).getByRole('button', { name: 'Hide' }));
		const field = screen.getByLabelText(/Note, shown to the author/);
		await key('j', {}, field);
		await key('a', {}, field);
		expect(row('c1').getAttribute('aria-current')).toBe('true');
		expect(posted).toEqual([]);
	});

	it('does nothing while a modifier key is held', async () => {
		mount([item('c1'), item('c2')]);
		await key('j', { ctrlKey: true });
		await key('a', { metaKey: true });
		await key('j', { altKey: true });
		expect(row('c1').getAttribute('aria-current')).toBe('true');
		expect(posted).toEqual([]);
	});

	it('does nothing when the setting is off, and the buttons still work', async () => {
		moderationPrefs.setShortcuts(false);
		mount([item('c1'), item('c2')]);
		await key('j');
		await key('a');
		expect(row('c1').getAttribute('aria-current')).toBe('true');
		expect(posted).toEqual([]);
		expect(
			within(panel())
				.getByRole('button', { name: 'Approve comment' })
				.getAttribute('aria-keyshortcuts')
		).toBeNull();
		await fireEvent.click(within(panel()).getByRole('button', { name: 'Approve comment' }));
		expect(posted).toEqual(['?/approve']);
	});

	it('says which key each button answers to while the shortcuts are on', () => {
		mount([item('c1')]);
		const keys = (name: string) =>
			within(panel()).getByRole('button', { name }).getAttribute('aria-keyshortcuts');
		expect(keys('Approve comment')).toBe('a');
		expect(keys('Hide')).toBe('h');
		expect(keys('Reject')).toBe('x');
	});
});
