import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { OwnProfile, ProfileComment, PublicProfile } from '#lib/media/types/profile.ts';

const { default: Page } = await import('../+page.svelte');
const { toasts } = await import('#lib/media/utils/toasts.svelte.js');
const { session } = await import('#lib/media/utils/session.svelte.js');

const entry = (id: string, over: Partial<ProfileComment> = {}): ProfileComment => ({
	id,
	body: `Text of ${id}`,
	score: 3,
	createdAt: '2026-11-01T10:00:00.000Z',
	edited: false,
	title: { kind: 'movie', tmdbId: 348, name: 'Alien' },
	inReplyTo: null,
	...over
});

const PROFILE: PublicProfile = {
	id: 'anna-id',
	username: 'anna',
	avatarKey: null,
	staffRole: null,
	joinedAt: '2026-01-15',
	scoreTotal: 42,
	commentCount: 2,
	comments: { comments: [entry('c1'), entry('c2')], nextCursor: null },
	reports: [{ kind: 'tv', tmdbId: 70523, name: 'Dark' }]
};

const mount = (profile: PublicProfile = PROFILE) => render(Page, { data: { profile } } as never);

afterEach(() => {
	cleanup();
	toasts.clear();
	vi.unstubAllGlobals();
});

describe('the public profile page', () => {
	it('shows the name, join date and comment score, and no role for an ordinary account', () => {
		mount();
		expect(screen.getByRole('heading', { level: 1, name: 'anna' })).toBeTruthy();
		expect(screen.getByText('Joined').nextElementSibling?.textContent).toBe('January 15, 2026');
		expect(screen.getByText('Comment score').nextElementSibling?.textContent).toBe('42');
		expect(screen.queryByText('Moderator')).toBeNull();
		expect(screen.queryByText('Administrator')).toBeNull();
	});

	it.each([
		['moderator', 'Moderator'],
		['administrator', 'Administrator']
	] as const)('badges a %s', (staffRole, label) => {
		mount({ ...PROFILE, staffRole });
		expect(screen.getByText(label)).toBeTruthy();
	});

	it('lists each comment with its title link, a dated link to the comment and its score', () => {
		mount();
		const first = screen.getByText('Text of c1').closest('li')!;
		expect(first.querySelector('a[href="/movie/348"]')?.textContent).toBe('Alien');
		expect(first.querySelector('a[href="/movie/348#comment-c1"]')).not.toBeNull();
		expect(first.textContent).toContain('Score 3');
	});

	it('links the author a reply answers to their profile', () => {
		const reply = entry('c3', { inReplyTo: { displayName: 'bea', username: 'bea' } });
		mount({ ...PROFILE, comments: { comments: [reply], nextCursor: null } });
		expect(screen.getByRole('link', { name: 'bea' }).getAttribute('href')).toBe('/u/bea');
	});

	it('shows a comment on a title with no TMDB id as plain text', () => {
		const loose = entry('c4', { title: { kind: 'movie', tmdbId: null, name: 'Unrouted' } });
		mount({ ...PROFILE, comments: { comments: [loose], nextCursor: null } });
		expect(screen.getByText('Unrouted').closest('a')).toBeNull();
	});

	it('lists the counted community reports by title, with no date', async () => {
		mount();
		await fireEvent.click(screen.getByRole('tab', { name: /Community reports/ }));
		const row = screen.getByRole('link', { name: 'Dark' }).closest('li')!;
		expect(screen.getByRole('link', { name: 'Dark' }).getAttribute('href')).toBe('/tv/70523');
		expect(row.textContent?.trim()).toBe('Dark');
		expect(screen.queryByText(/Updated/)).toBeNull();
	});

	it('has a Comments tab, open first, and a Community reports tab, each with its count', () => {
		mount();
		const tabs = screen.getAllByRole('tab');
		expect(tabs.map((t) => t.textContent?.replace(/\s+/g, ' ').trim())).toEqual([
			'Comments 2',
			'Community reports 1'
		]);
		expect(tabs[0].getAttribute('aria-selected')).toBe('true');
		expect(screen.getByRole('tabpanel').getAttribute('aria-labelledby')).toBe('tab-comments');
	});

	it('moves between the tabs with the arrow keys', async () => {
		mount();
		await fireEvent.keyDown(screen.getByRole('tab', { name: /Comments/ }), { key: 'ArrowRight' });
		expect(
			screen.getByRole('tab', { name: /Community reports/ }).getAttribute('aria-selected')
		).toBe('true');
		expect(screen.getByRole('link', { name: 'Dark' })).toBeTruthy();
	});

	it('opens the reports tab from #reports', () => {
		location.hash = '#reports';
		try {
			mount();
			expect(screen.getByRole('link', { name: 'Dark' })).toBeTruthy();
		} finally {
			location.hash = '';
		}
	});

	it('says Edited for an edited comment, without a time', () => {
		mount({
			...PROFILE,
			comments: { comments: [entry('c6', { edited: true })], nextCursor: null }
		});
		expect(screen.getByText('Edited')).toBeTruthy();
	});

	it('says so when there are no comments and no counted community reports', async () => {
		mount({ ...PROFILE, comments: { comments: [], nextCursor: null }, reports: [] });
		expect(screen.getByText('No published comments.')).toBeTruthy();
		expect(screen.queryByRole('button', { name: 'Show more comments' })).toBeNull();
		await fireEvent.click(screen.getByRole('tab', { name: /Community reports/ }));
		expect(screen.getByText('No counted community reports.')).toBeTruthy();
	});
});

describe('showing more comments', () => {
	const withMore = { ...PROFILE, comments: { ...PROFILE.comments, nextCursor: '99.c2' } };
	let fetcher: ReturnType<typeof vi.fn>;

	beforeEach(() => {
		fetcher = vi.fn();
		vi.stubGlobal('fetch', fetcher);
	});

	it('appends the next page in place, then drops the button on the last page', async () => {
		fetcher.mockResolvedValue(
			Response.json({ comments: [entry('c2'), entry('c5')], nextCursor: null })
		);
		mount(withMore);
		await fireEvent.click(screen.getByRole('button', { name: 'Show more comments' }));
		await screen.findByText('Text of c5');
		expect(fetcher).toHaveBeenCalledWith(
			'/api/users/anna/comments?cursor=99.c2',
			expect.objectContaining({ method: 'GET' })
		);
		expect(screen.getAllByText('Text of c2')).toHaveLength(1);
		expect(screen.queryByRole('button', { name: 'Show more comments' })).toBeNull();
	});

	it('toasts a failed load and keeps the button', async () => {
		fetcher.mockResolvedValue(new Response('{}', { status: 500 }));
		mount(withMore);
		await fireEvent.click(screen.getByRole('button', { name: 'Show more comments' }));
		await waitFor(() =>
			expect(toasts.items.map((t) => t.text)).toEqual([
				'More comments could not be loaded. Try again in a moment.'
			])
		);
		expect(screen.getByRole('button', { name: 'Show more comments' })).toBeTruthy();
	});
});

describe('the owner’s view', () => {
	const ANNA = {
		id: 'anna-id',
		username: 'anna',
		avatarKey: null,
		role: 'user' as const,
		displayName: 'anna'
	};
	const OWN: OwnProfile = {
		comments: [
			{
				id: 'p1',
				body: 'Waiting text',
				status: 'pending',
				score: 0,
				moderationReason: null,
				parentId: null,
				replyCount: 0,
				createdAt: '2026-11-02T10:00:00.000Z',
				editedAt: null,
				kind: 'movie',
				tmdbId: 348,
				title: 'Alien'
			}
		],
		reports: [
			{
				titleId: 't-dark',
				status: 'held',
				kind: 'tv',
				tmdbId: 70523,
				title: 'Dark',
				updatedAt: '2026-11-02T10:00:00.000Z',
				countsFrom: '2026-01-01T00:00:00.000Z',
				restricted: null
			}
		],
		mutedUntil: null
	};

	afterEach(() => session.clear());

	it('shows a visitor no owner actions', () => {
		session.set({ ...ANNA, id: 'bea-id', username: 'bea', displayName: 'bea' });
		mount();
		expect(screen.queryByRole('button', { name: 'Edit profile' })).toBeNull();
		expect(screen.queryByRole('link', { name: 'Settings' })).toBeNull();
	});

	it('gives the owner Edit profile and Settings, and their own comments and reports', async () => {
		const fetcher = vi.fn(async () => Response.json(OWN));
		vi.stubGlobal('fetch', fetcher);
		session.set(ANNA);
		mount();
		expect(screen.getByRole('link', { name: 'Settings' }).getAttribute('href')).toBe(
			'/user/settings'
		);
		await screen.findByText('Waiting text');
		expect(fetcher).toHaveBeenCalledWith('/api/me/profile', expect.anything());
		expect(screen.getByText('Awaiting review')).toBeTruthy();
		expect(screen.queryByText('Text of c1')).toBeNull();
		await fireEvent.click(screen.getByRole('tab', { name: /Community reports/ }));
		expect(screen.getByText('Waiting for review')).toBeTruthy();
	});

	it('opens the editor under the header and closes it on Cancel', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn(async () => Response.json(OWN))
		);
		session.set(ANNA);
		mount();
		await fireEvent.click(screen.getByRole('button', { name: 'Edit profile' }));
		expect(screen.getByRole('textbox', { name: 'Username' })).toBeTruthy();
		expect(screen.getByRole('heading', { level: 1, name: 'anna' })).toBeTruthy();
		await fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
		expect(screen.queryByRole('textbox', { name: 'Username' })).toBeNull();
		await waitFor(() =>
			expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Edit profile' }))
		);
	});

	it('names a mute, and says when the private view did not load', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn(async () =>
				Response.json({ ...OWN, mutedUntil: new Date(Date.now() + 86_400_000).toISOString() })
			)
		);
		session.set(ANNA);
		mount();
		expect(await screen.findByText(/This account is muted until/)).toBeTruthy();
		cleanup();
		session.clear();
		vi.stubGlobal(
			'fetch',
			vi.fn(async () => new Response('{}', { status: 500 }))
		);
		session.set(ANNA);
		mount();
		expect(await screen.findByText(/could not be loaded/)).toBeTruthy();
	});
});
