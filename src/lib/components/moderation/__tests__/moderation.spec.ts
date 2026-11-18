import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ModerationItem, RecentAction } from '#lib/media/types/moderation.ts';

const form = vi.hoisted(() => ({
	update: async () => {},
	result: { type: 'success', data: {} } as { type: string; data?: Record<string, unknown> }
}));

// `enhance` runs the component's submit callback and its result handler, with an `update` the
// test replaces to stand for the page re-rendering after the action.
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
			moderationRule: null,
			score: 0,
			replyCount: 0,
			createdAt: '2026-11-01T10:00:00.000Z',
			editedAt: null
		},
		author: AUTHOR,
		title: { kind: 'movie', tmdbId: 348, name: 'Alien' },
		aiCategories: [],
		severity: null,
		severe: false,
		parent: null,
		reports: [],
		authorCommentCount: 4,
		authorHiddenOrRejected: 0,
		authorOpenReportsAgainst: 0,
		authorJoinedAt: '2026-01-05T10:00:00.000Z',
		authorMutedUntil: null,
		authorBanned: false,
		authorMutedByModerator: false,
		...over
	};
}

const { toasts } = await import('#lib/media/utils/toasts.svelte.js');

afterEach(() => {
	cleanup();
	form.update = async () => {};
	form.result = { type: 'success', data: {} };
	toasts.clear();
});

/** The toasts showing, as `tone: text`. */
const shown = () => toasts.items.map((t) => `${t.tone}: ${t.text}`);

const MOD = { id: 'mod', role: 'moderator' };

function mount(
	over: Partial<ModerationItem> = {},
	extra: { me?: { id: string; role: string } } = {}
) {
	const list = document.body.appendChild(document.createElement('ul'));
	return render(ModerationItemRow, {
		props: { item: item(over), me: MOD, ...extra },
		target: list
	});
}

describe('ModerationItem', () => {
	it('says when the author is muted and offers no Mute account, and marks an edited comment', () => {
		mount({
			authorMutedUntil: '2026-11-20T10:00:00.000Z',
			authorBanned: false,
			authorMutedByModerator: false,
			comment: { ...item().comment, editedAt: '2026-11-02T10:00:00.000Z' }
		});
		expect(screen.getByText(/Muted until/)).toBeTruthy();
		expect(screen.queryByRole('button', { name: 'Mute account' })).toBeNull();
		expect(screen.getByRole('button', { name: 'Ban account' })).toBeTruthy();
		expect(screen.getByText('Edited')).toBeTruthy();
	});

	it('shows the comment, its title link and the author’s history count', () => {
		mount();
		expect(screen.getByText('A comment under review')).toBeTruthy();
		expect(screen.getByRole('link', { name: 'Alien' }).getAttribute('href')).toBe('/movie/348');
		expect(
			screen.getByText(
				/^4 comments in all · 0 hidden or rejected · 0 open reports against · Joined /
			)
		).toBeTruthy();
	});

	it('shows no category list until the classifier supplied categories', () => {
		mount();
		expect(screen.queryByLabelText('Categories from the automatic check')).toBeNull();
		cleanup();
		mount({ aiCategories: ['misogyny', 'slur'] });
		expect(screen.getByLabelText('Categories from the automatic check').textContent).toMatch(
			/Misogyny.*Slur/
		);
	});

	it('lists each open report with its reason and note', () => {
		mount({
			reports: [
				{
					reason: 'spam',
					note: 'An advert',
					createdAt: '2026-11-02T10:00:00.000Z',
					reporter: 'bo',
					reporterId: 'rep',
					record: { total: 3, upheld: 2, dismissed: 1 }
				},
				{
					reason: 'hate',
					note: null,
					createdAt: '2026-11-02T11:00:00.000Z',
					reporter: null,
					reporterId: 'rep',
					record: { total: 3, upheld: 2, dismissed: 1 }
				}
			]
		});
		expect(screen.getByText('2 open reports')).toBeTruthy();
		expect(
			screen.getByText((_, el) => el?.tagName === 'SPAN' && el.textContent === 'Reported by bo')
		).toBeTruthy();
		expect(screen.getByRole('link', { name: 'bo' }).getAttribute('href')).toBe(
			'/user/moderation/accounts/rep'
		);
		expect(screen.getByRole('link', { name: 'Public profile of bo' }).getAttribute('href')).toBe(
			'/u/bo'
		);
		expect(screen.getAllByText('Earlier reports: 2 of 3 upheld')).toHaveLength(2);
		expect(
			screen.getByText(
				(_, el) => el?.tagName === 'SPAN' && el.textContent === 'Reported by An account'
			)
		).toBeTruthy();
		expect(screen.getByRole('link', { name: 'An account' }).getAttribute('href')).toBe(
			'/user/moderation/accounts/rep'
		);
		expect(screen.getByText('Spam')).toBeTruthy();
		expect(screen.getByText('An advert')).toBeTruthy();
		expect(screen.getByText('Hate or bigotry')).toBeTruthy();
		expect(screen.getByRole('button', { name: 'Dismiss reports' })).toBeTruthy();
	});

	it('offers Approve on a pending comment only, and Dismiss only with reports', () => {
		mount();
		expect(screen.getByRole('button', { name: 'Approve comment' })).toBeTruthy();
		expect(screen.queryByRole('button', { name: 'Dismiss reports' })).toBeNull();
		cleanup();
		mount({ comment: { ...item().comment, status: 'published' } });
		expect(screen.queryByRole('button', { name: 'Approve comment' })).toBeNull();
	});

	it('hides every control for an author the moderator cannot act on', () => {
		mount(
			{
				author: { ...AUTHOR, role: 'administrator' },
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
			},
			{}
		);
		for (const name of [
			'Approve comment',
			'Dismiss reports',
			'Hide',
			'Reject',
			'Mute account',
			'Ban account'
		])
			expect(screen.queryByRole('button', { name })).toBeNull();
	});

	it('offers an administrator every control on an administrator’s comment, Mute and Ban excepted on themselves', () => {
		const admin = { ...AUTHOR, id: 'boss', role: 'administrator' as const };
		mount({ author: admin }, { me: { id: 'other', role: 'administrator' } });
		for (const name of ['Approve comment', 'Hide', 'Reject', 'Mute account', 'Ban account'])
			expect(screen.getByRole('button', { name })).toBeTruthy();
		cleanup();
		mount({ author: admin }, { me: { id: 'boss', role: 'administrator' } });
		for (const name of ['Approve comment', 'Hide', 'Reject'])
			expect(screen.getByRole('button', { name })).toBeTruthy();
		expect(screen.queryByRole('button', { name: 'Mute account' })).toBeNull();
		expect(screen.queryByRole('button', { name: 'Ban account' })).toBeNull();
	});

	it('asks for a confirmation that names the consequence of a ban', async () => {
		mount();
		await fireEvent.click(screen.getByRole('button', { name: 'Ban account' }));
		expect(screen.getByText(/Its sessions end, it cannot sign in/)).toBeTruthy();
		expect(screen.getByText(/Only an administrator can lift a ban/)).toBeTruthy();
		expect(screen.getAllByRole('button', { name: 'Ban account' })).toHaveLength(2);
		await fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
		expect(screen.getAllByRole('button', { name: 'Ban account' })).toHaveLength(1);
	});

	it('names what a reject does to the author before it is sent', async () => {
		mount();
		await fireEvent.click(screen.getByRole('button', { name: 'Reject' }));
		expect(
			screen.getByText(/the author sees it as rejected, with the rule and the note/)
		).toBeTruthy();
		const form = screen.getByRole('button', { name: 'Reject comment' }).closest('form')!;
		expect(form.getAttribute('action')).toBe('?/reject');
		expect((form.querySelector('[name=id]') as HTMLInputElement).value).toBe('c1');
	});

	it('offers a listed mute length and posts the author id', async () => {
		mount();
		await fireEvent.click(screen.getByRole('button', { name: 'Mute account' }));
		const select = screen.getByLabelText('Length');
		expect([...select.querySelectorAll('option')].map((o) => o.textContent)).toEqual([
			'1 day',
			'7 days',
			'30 days'
		]);
		const form = select.closest('form')!;
		expect((form.querySelector('[name=userId]') as HTMLInputElement).value).toBe('u1');
	});

	it('toasts a refusal and keeps the row', async () => {
		form.result = {
			type: 'failure',
			data: { id: 'c1', error: 'The comment is no longer in a state this action applies to.' }
		};
		mount();
		await fireEvent.submit(
			screen.getByRole('button', { name: 'Approve comment' }).closest('form') as HTMLFormElement
		);
		await waitFor(() =>
			expect(shown()).toEqual([
				'error: The comment is no longer in a state this action applies to.'
			])
		);
		expect(document.getElementById('comment-c1')).toBeTruthy();
	});

	it('toasts what an action that went through did', async () => {
		form.result = { type: 'success', data: { id: 'c1', done: 'approve' } };
		mount();
		await fireEvent.submit(
			screen.getByRole('button', { name: 'Approve comment' }).closest('form') as HTMLFormElement
		);
		await waitFor(() => expect(shown()).toEqual(['success: Comment approved.']));
	});

	it('marks the pressed button busy and holds the others until the action ends', async () => {
		let release!: () => void;
		form.update = () => new Promise<void>((r) => (release = r));
		mount({
			reports: [
				{
					reason: 'spam',
					note: null,
					createdAt: '2026-11-02T10:00:00.000Z',
					reporter: null,
					reporterId: 'rep',
					record: { total: 3, upheld: 2, dismissed: 1 }
				}
			]
		});
		const approve = screen.getByRole('button', { name: 'Approve comment' });
		await fireEvent.submit(approve.closest('form') as HTMLFormElement);
		await waitFor(() => expect(approve.getAttribute('aria-busy')).toBe('true'));
		// The pressed button keeps the focus, so it stays enabled; the others wait.
		expect((approve as HTMLButtonElement).disabled).toBe(false);
		expect(screen.getByRole('button', { name: 'Dismiss reports' })).toHaveProperty(
			'disabled',
			true
		);
		release();
		await waitFor(() => expect(approve.getAttribute('aria-busy')).toBe('false'));
	});
});

describe('focus after an action', () => {
	function mountTwo(second = true) {
		const list = document.body.appendChild(document.createElement('ul'));
		const first = render(ModerationItemRow, {
			props: { item: item(), me: MOD },
			target: list
		});
		if (second) {
			render(ModerationItemRow, {
				props: {
					item: item({ comment: { ...item().comment, id: 'c2' } }),
					me: MOD
				},
				target: list
			});
		}
		return { list, first };
	}

	it('moves to the next row when the comment leaves the queue', async () => {
		const { list } = mountTwo();
		form.update = async () => {
			document.getElementById('comment-c1')?.remove();
		};
		await fireEvent.submit(
			screen
				.getAllByRole('button', { name: 'Approve comment' })[0]
				.closest('form') as HTMLFormElement
		);
		await waitFor(() => expect(document.activeElement).toBe(list.querySelector('#comment-c2')));
	});

	it('moves to the empty-state line when the last row leaves', async () => {
		mountTwo(false);
		document.body.insertAdjacentHTML(
			'beforeend',
			'<p id="moderation-empty" tabindex="-1">No comments are waiting for review.</p>'
		);
		form.update = async () => {
			document.getElementById('comment-c1')?.remove();
		};
		await fireEvent.submit(
			screen.getByRole('button', { name: 'Approve comment' }).closest('form') as HTMLFormElement
		);
		await waitFor(() => expect(document.activeElement?.id).toBe('moderation-empty'));
	});

	it('stays on a row that is still there, such as one that was only muted', async () => {
		mountTwo(false);
		await fireEvent.click(screen.getByRole('button', { name: 'Mute account' }));
		await fireEvent.click(screen.getAllByRole('radio')[0]);
		const submitButton = screen
			.getAllByRole('button', { name: 'Mute account' })
			.find((b) => b.closest('form'));
		await fireEvent.submit(submitButton?.closest('form') as HTMLFormElement);
		await waitFor(() => expect(document.activeElement?.id).toBe('comment-c1'));
	});
});

describe('RecentActionRow', () => {
	const entry = (over: Partial<RecentAction> = {}): RecentAction => ({
		id: 'a1',
		action: 'reject',
		reason: 'Slur',
		rule: null,
		createdAt: '2026-11-03T10:00:00.000Z',
		actor: { ...AUTHOR, id: 'mod', displayName: 'mod' },
		targetUser: null,
		muteHours: null,
		commentBody: 'The rejected text',
		commentId: 'c1',
		commentStatus: 'rejected',
		commentEditedAt: null,
		inForce: null,
		flag: null,
		reverses: null,
		latestForComment: true,
		title: { id: 't1', kind: 'movie', tmdbId: 348, name: 'Alien' },
		...over
	});

	function mountEntry(e: RecentAction) {
		const list = document.body.appendChild(document.createElement('ul'));
		return render(RecentActionRow, {
			props: { entry: e, me: { id: 'mod', role: 'moderator' } },
			target: list
		});
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
		cleanup();
		mountEntry(entry({ latestForComment: false }));
		expect(screen.queryByRole('button', { name: 'Restore comment' })).toBeNull();
	});

	it('links the title and marks a comment edited after the action', () => {
		mountEntry(entry({ commentEditedAt: '2026-11-04T10:00:00.000Z' }));
		expect(screen.getByRole('link', { name: 'Alien' }).getAttribute('href')).toBe('/movie/348');
		expect(screen.getByText('Edited since')).toBeTruthy();
		cleanup();
		mountEntry(entry({ commentEditedAt: '2026-11-02T10:00:00.000Z' }));
		expect(screen.queryByText('Edited since')).toBeNull();
	});

	it('gives the length of a mute', () => {
		mountEntry(
			entry({
				action: 'mute',
				muteHours: 168,
				commentId: null,
				commentBody: null,
				commentStatus: null,
				title: null,
				targetUser: AUTHOR
			})
		);
		expect(screen.getByText(/muted/).textContent).toMatch(/anna for 7 days/);
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
