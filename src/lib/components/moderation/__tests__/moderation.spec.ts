import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { HeldReport, ModerationItem, RecentAction } from '#lib/media/types/moderation.ts';

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
const { default: HeldReportRow } = await import('../heldReportRow.svelte');

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
		authorMutedUntil: null,
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
	it('says when the author is muted and offers no Mute author, and marks an edited comment', () => {
		mount({
			authorMutedUntil: '2026-11-20T10:00:00.000Z',
			comment: { ...item().comment, editedAt: '2026-11-02T10:00:00.000Z' }
		});
		expect(screen.getByText(/Muted until/)).toBeTruthy();
		expect(screen.queryByRole('button', { name: 'Mute author' })).toBeNull();
		expect(screen.getByRole('button', { name: 'Ban author' })).toBeTruthy();
		expect(screen.getByText('Edited')).toBeTruthy();
	});

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
					reporter: 'bo'
				},
				{ reason: 'hate', note: null, createdAt: '2026-11-02T11:00:00.000Z', reporter: null }
			]
		});
		expect(screen.getByText('2 open reports')).toBeTruthy();
		expect(
			screen.getByText((_, el) => el?.tagName === 'SPAN' && el.textContent === 'Reported by bo')
		).toBeTruthy();
		expect(screen.getByRole('link', { name: 'bo' }).getAttribute('href')).toBe('/u/bo');
		expect(screen.getByText('Reported by An account')).toBeTruthy();
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

	it('hides every control for an author the moderator cannot act on', () => {
		mount(
			{
				author: { ...AUTHOR, role: 'administrator' },
				reports: [
					{ reason: 'spam', note: null, createdAt: '2026-11-02T10:00:00.000Z', reporter: 'bo' }
				]
			},
			{}
		);
		for (const name of [
			'Approve',
			'Dismiss reports',
			'Hide',
			'Reject',
			'Mute author',
			'Ban author'
		])
			expect(screen.queryByRole('button', { name })).toBeNull();
	});

	it('offers an administrator every control on an administrator’s comment, Mute and Ban excepted on themselves', () => {
		const admin = { ...AUTHOR, id: 'boss', role: 'administrator' as const };
		mount({ author: admin }, { me: { id: 'other', role: 'administrator' } });
		for (const name of ['Approve', 'Hide', 'Reject', 'Mute author', 'Ban author'])
			expect(screen.getByRole('button', { name })).toBeTruthy();
		cleanup();
		mount({ author: admin }, { me: { id: 'boss', role: 'administrator' } });
		for (const name of ['Approve', 'Hide', 'Reject'])
			expect(screen.getByRole('button', { name })).toBeTruthy();
		expect(screen.queryByRole('button', { name: 'Mute author' })).toBeNull();
		expect(screen.queryByRole('button', { name: 'Ban author' })).toBeNull();
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

	it('toasts a refusal and keeps the row', async () => {
		form.result = {
			type: 'failure',
			data: { id: 'c1', error: 'The comment is no longer in a state this action applies to.' }
		};
		mount();
		await fireEvent.submit(
			screen.getByRole('button', { name: 'Approve' }).closest('form') as HTMLFormElement
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
			screen.getByRole('button', { name: 'Approve' }).closest('form') as HTMLFormElement
		);
		await waitFor(() => expect(shown()).toEqual(['success: Comment approved.']));
	});

	it('marks the pressed button busy and holds the others until the action ends', async () => {
		let release!: () => void;
		form.update = () => new Promise<void>((r) => (release = r));
		mount({
			reports: [
				{ reason: 'spam', note: null, createdAt: '2026-11-02T10:00:00.000Z', reporter: null }
			]
		});
		const approve = screen.getByRole('button', { name: 'Approve' });
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
			screen.getAllByRole('button', { name: 'Approve' })[0].closest('form') as HTMLFormElement
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
			screen.getByRole('button', { name: 'Approve' }).closest('form') as HTMLFormElement
		);
		await waitFor(() => expect(document.activeElement?.id).toBe('moderation-empty'));
	});

	it('stays on a row that is still there, such as one that was only muted', async () => {
		mountTwo(false);
		await fireEvent.click(screen.getByRole('button', { name: 'Mute author' }));
		await fireEvent.submit(
			screen.getByRole('button', { name: 'Mute account' }).closest('form') as HTMLFormElement
		);
		await waitFor(() => expect(document.activeElement?.id).toBe('comment-c1'));
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
		muteHours: null,
		commentBody: 'The rejected text',
		commentId: 'c1',
		commentStatus: 'rejected',
		commentEditedAt: null,
		title: { id: 't1', kind: 'movie', tmdbId: 348, name: 'Alien' },
		...over
	});

	function mountEntry(e: RecentAction) {
		const list = document.body.appendChild(document.createElement('ul'));
		return render(RecentActionRow, { props: { entry: e }, target: list });
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

describe('the held report row', () => {
	const answers = {
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
	const base: HeldReport = {
		titleId: 't1',
		title: { kind: 'movie', tmdbId: 348, name: 'Alien' },
		account: {
			userId: 'u1',
			username: 'anna',
			createdAt: new Date(Date.now() - 3 * 86_400_000).toISOString(),
			reportCount: 4,
			commentCount: 1,
			role: 'user',
			countsFrom: new Date(Date.now() + 4 * 86_400_000).toISOString(),
			restricted: null
		},
		holdReason: 'busy_new_account',
		createdAt: '2026-11-10T10:00:00.000Z',
		answers: { ...answers },
		um: null
	};
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

	it('shows the title, the account, the hold reason and the two actions', () => {
		render(HeldReportRow, { report: base, canAct: true });
		expect(screen.getByRole('link', { name: 'Alien' }).getAttribute('href')).toBe('/movie/348');
		expect(
			screen.getByText(/anna, 3 days old, 4 community reports not rejected, 1 comment/)
		).toBeTruthy();
		expect(screen.getByText('Busy new account')).toBeTruthy();
		expect(screen.getByRole('button', { name: 'Count it' })).toBeTruthy();
		expect(screen.getByRole('button', { name: 'Reject' })).toBeTruthy();
	});

	it('offers no actions for an account the actor cannot act on', () => {
		render(HeldReportRow, { report: base, canAct: false });
		expect(screen.queryByRole('button', { name: 'Count it' })).toBeNull();
		expect(screen.queryByRole('button', { name: 'Reject' })).toBeNull();
		expect(screen.getByText('An administrator decides on this report.')).toBeTruthy();
	});

	it('shows UM flags only when the report contradicts the source', () => {
		const { unmount } = render(HeldReportRow, { report: base, canAct: true });
		expect(screen.queryByText('Unconsenting Media')).toBeNull();
		unmount();
		render(HeldReportRow, {
			report: { ...base, holdReason: 'contradicts_source', um: UM },
			canAct: true
		});
		expect(screen.getByText('Contradicts Unconsenting Media')).toBeTruthy();
		expect(screen.getByRole('columnheader', { name: 'Unconsenting Media' })).toBeTruthy();
		expect(screen.getByRole('rowheader', { name: /Rape on screen/ })).toBeTruthy();
	});
});
