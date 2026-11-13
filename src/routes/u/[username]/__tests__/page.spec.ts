import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ProfileComment, PublicProfile } from '#lib/media/types/profile.ts';

const { default: Page } = await import('../+page.svelte');
const { toasts } = await import('#lib/media/utils/toasts.svelte.js');

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

	it('lists the counted community reports by title, with no date', () => {
		mount();
		const row = screen.getByRole('link', { name: 'Dark' }).closest('li')!;
		expect(screen.getByRole('link', { name: 'Dark' }).getAttribute('href')).toBe('/tv/70523');
		expect(row.textContent?.trim()).toBe('Dark');
		expect(screen.queryByText(/Updated/)).toBeNull();
	});

	it('puts the counted community reports above the comments', () => {
		mount();
		const headings = screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent);
		expect(headings).toEqual(['Counted community reports', 'Comments']);
	});

	it('says Edited for an edited comment, without a time', () => {
		mount({
			...PROFILE,
			comments: { comments: [entry('c6', { edited: true })], nextCursor: null }
		});
		expect(screen.getByText('Edited')).toBeTruthy();
	});

	it('says so when there are no comments and no counted community reports', () => {
		mount({ ...PROFILE, comments: { comments: [], nextCursor: null }, reports: [] });
		expect(screen.getByText('No published comments.')).toBeTruthy();
		expect(screen.getByText('No counted community reports.')).toBeTruthy();
		expect(screen.queryByRole('button', { name: 'Show more comments' })).toBeNull();
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
