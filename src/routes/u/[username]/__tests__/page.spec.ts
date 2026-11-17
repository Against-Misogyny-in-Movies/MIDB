import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ProfileComment, ProfileReport, PublicProfile } from '#lib/media/types/profile.ts';

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
	commentCount: 2,
	reportCount: 1,
	titleCount: 2,
	comments: { comments: [entry('c1'), entry('c2')], nextCursor: null },
	reports: { reports: [{ kind: 'tv', tmdbId: 70523, name: 'Dark' }], nextCursor: null }
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
		expect(screen.getByText('Joined').nextElementSibling?.textContent).toBe('15/01/2026');
		expect(screen.getByText('Comment score').nextElementSibling?.textContent).toBe('42');
		expect(screen.queryByText('Moderator')).toBeNull();
		expect(screen.queryByText('Administrator')).toBeNull();
	});

	it('shows four figures in the header, each named once, and a zero as 0', () => {
		mount();
		const figures = ['Comment score', 'Comments', 'Community reports', 'Films and series'].map(
			(name) => screen.getAllByText(name).find((el) => el.tagName === 'DT')!
		);
		expect(figures.map((dt) => dt.nextElementSibling?.textContent)).toEqual(['42', '2', '1', '2']);
		cleanup();
		mount({ ...PROFILE, scoreTotal: 0, commentCount: 0, reportCount: 0, titleCount: 0 });
		const zeros = screen.getAllByText('0').filter((el) => el.tagName === 'DD');
		expect(zeros).toHaveLength(4);
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

	it('has a Comments tab, open first, and a Community reports tab, with no counts on them', () => {
		mount();
		const tabs = screen.getAllByRole('tab');
		expect(tabs.map((t) => t.textContent?.trim())).toEqual(['Comments', 'Community reports']);
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
		mount({
			...PROFILE,
			comments: { comments: [], nextCursor: null },
			reports: { reports: [], nextCursor: null }
		});
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

describe('showing more community reports', () => {
	const report = (name: string, tmdbId: number): ProfileReport => ({ kind: 'movie', tmdbId, name });
	const withMore = {
		...PROFILE,
		reports: { reports: [report('Alien', 348)], nextCursor: '99.t1' }
	};
	let fetcher: ReturnType<typeof vi.fn>;

	beforeEach(() => {
		fetcher = vi.fn();
		vi.stubGlobal('fetch', fetcher);
	});

	async function openReports() {
		mount(withMore);
		await fireEvent.click(screen.getByRole('tab', { name: 'Community reports' }));
	}

	it('appends the next page in place, moves the focus to the first new row and ends on the last page', async () => {
		fetcher.mockResolvedValue(
			Response.json({
				reports: [report('Alien', 348), report('Aliens', 679)],
				nextCursor: null
			})
		);
		await openReports();
		await fireEvent.click(screen.getByRole('button', { name: 'Show more community reports' }));
		await screen.findByRole('link', { name: 'Aliens' });
		expect(fetcher).toHaveBeenCalledWith(
			'/api/users/anna/reports?cursor=99.t1',
			expect.objectContaining({ method: 'GET' })
		);
		expect(screen.getAllByRole('link', { name: 'Alien' })).toHaveLength(1);
		await waitFor(() => expect(document.activeElement?.id).toBe('profile-report-1'));
		expect(screen.queryByRole('button', { name: 'Show more community reports' })).toBeNull();
	});

	it('toasts a failed load, keeps the button and returns the focus to it', async () => {
		fetcher.mockResolvedValue(new Response('{}', { status: 500 }));
		await openReports();
		const button = screen.getByRole('button', { name: 'Show more community reports' });
		await fireEvent.click(button);
		await waitFor(() =>
			expect(toasts.items.map((t) => t.text)).toEqual([
				'More community reports could not be loaded. Try again in a moment.'
			])
		);
		await waitFor(() => expect(document.activeElement).toBe(button));
	});

	it('has no button on a single page', async () => {
		mount();
		await fireEvent.click(screen.getByRole('tab', { name: 'Community reports' }));
		expect(screen.queryByRole('button', { name: 'Show more community reports' })).toBeNull();
	});
});
