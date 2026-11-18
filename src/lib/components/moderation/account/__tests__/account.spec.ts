import { cleanup, fireEvent, render, screen, within } from '@testing-library/svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type {
	AccountComment,
	AccountNote,
	AccountReport,
	AccountView,
	ReportAgainst
} from '#lib/media/types/moderation.ts';

const posted = vi.hoisted(() => [] as { action: string; fields: Record<string, string> }[]);

vi.mock('$app/forms', () => ({
	enhance: (node: HTMLFormElement) => {
		const onSubmit = (event: Event) => {
			event.preventDefault();
			posted.push({
				action: node.getAttribute('action') ?? '',
				fields: Object.fromEntries(new FormData(node) as unknown as Iterable<[string, string]>)
			});
		};
		node.addEventListener('submit', onSubmit);
		return { destroy: () => node.removeEventListener('submit', onSubmit) };
	}
}));
vi.mock('$app/navigation', () => ({ goto: vi.fn(), invalidateAll: vi.fn() }));

const { default: AccountSummary } = await import('../accountSummary.svelte');
const { default: AccountNotes } = await import('../accountNotes.svelte');
const { default: AccountLists } = await import('../accountLists.svelte');
const { default: AccountLink } = await import('../../accountLink.svelte');

afterEach(() => {
	cleanup();
	posted.length = 0;
});

const MOD = { id: 'mod', role: 'moderator' };
const ADMIN = { id: 'admin', role: 'administrator' };

const view = (over: Partial<AccountView> = {}): AccountView => ({
	user: {
		id: 'acct',
		username: 'woolf_2210',
		avatarKey: null,
		role: 'user',
		displayName: 'woolf_2210'
	},
	joinedAt: '2026-09-02T10:00:00.000Z',
	deleted: false,
	mutedUntil: null,
	mutedByModerator: false,
	banned: null,
	figures: {
		comments: 46,
		hiddenOrRejected: 7,
		openReportsAgainst: 12,
		communityReports: 18,
		communityReportsLive: 18,
		reportsMade: { total: 5, upheld: 4, dismissed: 1 }
	},
	...over
});

describe('accountLink', () => {
	it('links the name to the account page and offers the public profile beside it', () => {
		render(AccountLink, { id: 'a1', username: 'bo' });
		expect(screen.getByRole('link', { name: 'bo' }).getAttribute('href')).toBe(
			'/user/moderation/accounts/a1'
		);
		expect(screen.getByRole('link', { name: 'Public profile of bo' }).getAttribute('href')).toBe(
			'/u/bo'
		);
	});

	it('names an account with no username "Account" and offers no profile', () => {
		render(AccountLink, { id: 'a1', username: null });
		expect(screen.getByRole('link', { name: 'Account' })).toBeTruthy();
		expect(screen.queryByRole('link', { name: /Public profile/ })).toBeNull();
	});

	it('is plain text without an id, and still offers the profile', () => {
		render(AccountLink, { id: null, username: 'bo', name: 'bo' });
		expect(screen.queryByRole('link', { name: 'bo' })).toBeNull();
		expect(screen.getByRole('link', { name: 'Public profile of bo' })).toBeTruthy();
	});
});

describe('accountSummary', () => {
	it('shows the name, role, join day, figures and the reporter record', () => {
		render(AccountSummary, {
			account: view({ user: { ...view().user, role: 'moderator' } }),
			me: ADMIN
		});
		expect(screen.getByRole('heading', { name: 'woolf_2210' })).toBeTruthy();
		expect(screen.getByText('Moderator')).toBeTruthy();
		expect(screen.getByText('02/09/2026')).toBeTruthy();
		const figure = (name: string) => screen.getByText(name).closest('div')!;
		expect(figure('Comments').textContent).toContain('46');
		expect(figure('Hidden or rejected').textContent).toContain('7');
		expect(figure('Open reports against').textContent).toContain('12');
		expect(figure('Community reports').textContent).toContain('18');
		expect(figure('Comment reports made').textContent).toContain('5');
		expect(figure('Comment reports made').textContent).toContain('Earlier reports: 4 of 5 upheld');
	});

	it('says a mute with its end day, and offers End mute to an administrator', () => {
		render(AccountSummary, {
			account: view({ mutedUntil: '2026-11-24T10:00:00.000Z', mutedByModerator: false }),
			me: ADMIN
		});
		expect(screen.getByText('Muted until 24/11/2026')).toBeTruthy();
		expect(screen.getByRole('button', { name: 'End mute' })).toBeTruthy();
		expect(screen.getByRole('button', { name: 'Ban account' })).toBeTruthy();
		expect(screen.queryByRole('button', { name: 'Mute account' })).toBeNull();
	});

	it('lets a moderator end only a mute a moderator set', () => {
		const { unmount } = render(AccountSummary, {
			account: view({ mutedUntil: '2026-11-24T10:00:00.000Z', mutedByModerator: false }),
			me: MOD
		});
		expect(screen.queryByRole('button', { name: 'End mute' })).toBeNull();
		unmount();
		render(AccountSummary, {
			account: view({ mutedUntil: '2026-11-24T10:00:00.000Z', mutedByModerator: true }),
			me: MOD
		});
		expect(screen.getByRole('button', { name: 'End mute' })).toBeTruthy();
	});

	it('shows a ban with its day and reason, Lift ban only to an administrator, and no Mute or Ban', () => {
		const banned = view({ banned: { at: '2026-11-10T10:00:00.000Z', reason: 'Spam ring' } });
		const { unmount } = render(AccountSummary, { account: banned, me: ADMIN });
		expect(screen.getByText('Banned')).toBeTruthy();
		expect(screen.getByText('Banned on 10/11/2026. Reason: Spam ring')).toBeTruthy();
		expect(screen.getByRole('button', { name: 'Lift ban' })).toBeTruthy();
		expect(screen.queryByRole('button', { name: 'Mute account' })).toBeNull();
		expect(screen.queryByRole('button', { name: 'Ban account' })).toBeNull();
		unmount();
		const { unmount: unmount2 } = render(AccountSummary, { account: banned, me: MOD });
		expect(screen.queryByRole('button', { name: 'Lift ban' })).toBeNull();
		unmount2();
		const quiet = view({ banned: banned.banned });
		render(AccountSummary, {
			account: { ...quiet, figures: { ...quiet.figures!, communityReportsLive: 0 } },
			me: MOD
		});
		expect(screen.queryByText('Account')).toBeNull();
	});

	it('offers Mute and Ban on an ordinary account, and Reject all only when it has community reports', () => {
		const { unmount } = render(AccountSummary, { account: view(), me: MOD });
		expect(screen.getByRole('button', { name: 'Mute account' })).toBeTruthy();
		expect(screen.getByRole('button', { name: 'Ban account' })).toBeTruthy();
		expect(
			screen.getByRole('button', { name: 'Reject all community reports from this account' })
		).toBeTruthy();
		unmount();
		const none = view();
		render(AccountSummary, {
			account: { ...none, figures: { ...none.figures!, communityReportsLive: 0 } },
			me: MOD
		});
		expect(
			screen.queryByRole('button', { name: 'Reject all community reports from this account' })
		).toBeNull();
	});

	it('shows no action a moderator may not take on an administrator or on themselves', () => {
		render(AccountSummary, {
			account: view({ user: { ...view().user, id: 'admin', role: 'administrator' } }),
			me: MOD
		});
		expect(screen.queryByRole('button')).toBeNull();
	});

	it('opens the ban plate with the rule list and posts the account’s id', async () => {
		render(AccountSummary, { account: view(), me: MOD });
		await fireEvent.click(screen.getByRole('button', { name: 'Ban account' }));
		const plate = document.querySelector('form.plate') as HTMLFormElement;
		expect(plate.getAttribute('action')).toBe('?/ban');
		expect((plate.querySelector('[name=userId]') as HTMLInputElement).value).toBe('acct');
	});

	it('reads a deleted account as scrubbed: its standing, no figures, no actions', () => {
		render(AccountSummary, {
			account: view({
				user: { ...view().user, username: null, displayName: 'Account' },
				deleted: true,
				figures: null
			}),
			me: ADMIN
		});
		expect(screen.getByRole('heading', { name: 'Deleted account' })).toBeTruthy();
		expect(screen.getByText('Deleted')).toBeTruthy();
		expect(screen.getByText(/only its moderation log remains/)).toBeTruthy();
		expect(screen.queryByRole('button')).toBeNull();
		expect(screen.queryByText('Comments')).toBeNull();
	});
});

describe('accountNotes', () => {
	const note = (id: string, body: string, over: Partial<AccountNote> = {}): AccountNote => ({
		id,
		body,
		createdAt: '2026-11-17T10:00:00.000Z',
		author: 'ada_1234',
		authorId: 'ada',
		...over
	});

	it('lists each note with its date and author, linked to the author’s account', () => {
		render(AccountNotes, {
			userId: 'acct',
			notes: [
				note('n1', 'Second mute in a month.'),
				note('n2', 'Argues in good faith.', { author: null, authorId: null })
			],
			total: 2,
			canAdd: true
		});
		expect(screen.getByText('Second mute in a month.')).toBeTruthy();
		expect(screen.getAllByText('17/11/2026')).toHaveLength(2);
		expect(screen.getByRole('link', { name: 'ada_1234' }).getAttribute('href')).toBe(
			'/user/moderation/accounts/ada'
		);
		expect(screen.getByText('A removed account')).toBeTruthy();
	});

	it('says there are no notes, and when the list is the newest of more', () => {
		const { unmount } = render(AccountNotes, { userId: 'acct', notes: [], total: 0, canAdd: true });
		expect(screen.getByText('No notes yet.')).toBeTruthy();
		unmount();
		render(AccountNotes, { userId: 'acct', notes: [note('n1', 'x')], total: 60, canAdd: true });
		expect(screen.getByText('Showing the newest 1 of 60 notes.')).toBeTruthy();
	});

	it('offers the form with a length limit and a button that waits for text, and posts the note', async () => {
		render(AccountNotes, { userId: 'acct', notes: [], total: 0, canAdd: true });
		const field = screen.getByLabelText(/Add a note. Only staff see it./) as HTMLTextAreaElement;
		expect(field.maxLength).toBe(1000);
		const button = screen.getByRole('button', { name: 'Add note' }) as HTMLButtonElement;
		expect(button.disabled).toBe(true);
		await fireEvent.input(field, { target: { value: 'Watch this one' } });
		expect(button.disabled).toBe(false);
		await fireEvent.click(button);
		expect(posted).toEqual([
			{ action: '?/note', fields: { userId: 'acct', body: 'Watch this one' } }
		]);
	});

	it('has no form for staff who may not note the account', () => {
		render(AccountNotes, { userId: 'acct', notes: [note('n1', 'x')], total: 1, canAdd: false });
		expect(screen.queryByRole('button', { name: 'Add note' })).toBeNull();
		expect(screen.queryByLabelText(/Add a note/)).toBeNull();
	});
});

describe('accountLists', () => {
	const comments: AccountComment[] = [
		{
			id: 'c1',
			body: 'Aimed at another reader.',
			status: 'hidden',
			moderationReason: null,
			moderationRule: 'harassment',
			isReply: false,
			createdAt: '2026-11-17T10:00:00.000Z',
			editedAt: null,
			title: { kind: 'movie', tmdbId: 348, name: 'Alien' }
		},
		{
			id: 'c2',
			body: 'The linguist carries the film.',
			status: 'published',
			moderationReason: null,
			moderationRule: null,
			isReply: true,
			createdAt: '2026-11-12T10:00:00.000Z',
			editedAt: '2026-11-13T10:00:00.000Z',
			title: { kind: 'movie', tmdbId: 329865, name: 'Arrival' }
		}
	];
	const reports: AccountReport[] = [
		{
			titleId: 't1',
			status: 'held',
			kind: 'movie',
			tmdbId: 348,
			title: 'Alien',
			updatedAt: '2026-11-10T10:00:00.000Z',
			countsFrom: '2026-12-01T10:00:00.000Z',
			restricted: null
		}
	];
	const against: ReportAgainst[] = [
		{
			reason: 'harassment',
			note: 'Rude to a reader',
			createdAt: '2026-11-16T10:00:00.000Z',
			reporter: 'lorde_8841',
			reporterId: 'lorde',
			record: { total: 4, upheld: 3, dismissed: 1 },
			comment: {
				id: 'c1',
				body: 'Aimed at another reader.',
				status: 'published',
				title: { kind: 'movie', tmdbId: 348, name: 'Alien' }
			}
		}
	];
	const figures = view().figures!;
	const mount = (over: Partial<Parameters<typeof render<typeof AccountLists>>[1]> = {}) =>
		render(AccountLists, {
			comments,
			reports,
			against,
			figures: { ...figures, comments: 2, communityReports: 1, openReportsAgainst: 1 },
			...over
		});

	it('starts on the comments in every status, read only, with the rule on a hidden one', () => {
		mount();
		expect(screen.getByRole('tab', { name: /Comments/ }).getAttribute('aria-selected')).toBe(
			'true'
		);
		expect(screen.getByText('Hidden')).toBeTruthy();
		expect(screen.getByText('Published')).toBeTruthy();
		expect(screen.getByText(/A moderator hid this comment\. Harassment\./)).toBeTruthy();
		expect(screen.getByText('Reply')).toBeTruthy();
		expect(screen.getByText('Edited')).toBeTruthy();
		expect(screen.queryByRole('button', { name: /Edit|Delete/ })).toBeNull();
		expect(screen.getAllByRole('link', { name: 'View comment' })[0].getAttribute('href')).toBe(
			'/movie/348#comment-c1'
		);
	});

	it('shows each tab’s total in its label and switches the list', async () => {
		mount();
		expect(screen.getByRole('tab', { name: 'Comments 2' })).toBeTruthy();
		await fireEvent.click(screen.getByRole('tab', { name: 'Community reports 1' }));
		expect(screen.getByText('Held')).toBeTruthy();
		expect(screen.queryByText('Aimed at another reader.')).toBeNull();
		await fireEvent.click(screen.getByRole('tab', { name: 'Open reports against 1' }));
		const row = screen.getByText('Rude to a reader').closest('li')!;
		expect(within(row).getByText('Harassment')).toBeTruthy();
		expect(within(row).getByRole('link', { name: 'lorde_8841' }).getAttribute('href')).toBe(
			'/user/moderation/accounts/lorde'
		);
		expect(within(row).getByText('Earlier reports: 3 of 4 upheld')).toBeTruthy();
	});

	it('moves between tabs with the arrow keys, wrapping', async () => {
		mount();
		const first = screen.getByRole('tab', { name: /^Comments/ });
		await fireEvent.keyDown(first, { key: 'ArrowLeft' });
		expect(
			screen.getByRole('tab', { name: /^Open reports against/ }).getAttribute('aria-selected')
		).toBe('true');
		await fireEvent.keyDown(document.activeElement!, { key: 'ArrowRight' });
		expect(first.getAttribute('aria-selected')).toBe('true');
	});

	it('says what an empty tab holds, and that a list is the newest of more', async () => {
		const { unmount } = mount({
			comments: [],
			figures: { ...figures, comments: 0, communityReports: 0, openReportsAgainst: 0 }
		});
		expect(screen.getByText('This account has no comments.')).toBeTruthy();
		await fireEvent.click(screen.getByRole('tab', { name: /^Community reports/ }));
		expect(screen.getByText('This account has no community reports.')).toBeTruthy();
		await fireEvent.click(screen.getByRole('tab', { name: /^Open reports against/ }));
		expect(screen.getByText(/No open reports against this account’s comments/)).toBeTruthy();
		unmount();
		mount({ figures: { ...figures, comments: 120 } });
		expect(screen.getByText('Showing the newest 2 of 120.')).toBeTruthy();
	});
});
