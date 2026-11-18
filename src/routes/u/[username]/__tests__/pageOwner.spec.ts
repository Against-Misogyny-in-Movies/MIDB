import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { OwnProfile, ProfileComment, PublicProfile } from '#lib/media/types/profile.ts';

const { default: Page } = await import('../+page.svelte');
const { toasts } = await import('#lib/media/utils/toasts.svelte.js');
const { session } = await import('#lib/media/utils/session.svelte.js');

const entry = (id: string): ProfileComment => ({
	id,
	body: `Text of ${id}`,
	score: 3,
	createdAt: '2026-11-01T10:00:00.000Z',
	edited: false,
	title: { kind: 'movie', tmdbId: 348, name: 'Alien' },
	inReplyTo: null
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

describe('the owner’s view', () => {
	const ANNA = {
		id: 'anna-id',
		username: 'anna',
		avatarKey: null,
		role: 'user' as const,
		displayName: 'anna'
	};
	const OWN: OwnProfile = {
		notPublic: {
			comments: [
				{
					id: 'p1',
					body: 'Waiting text',
					status: 'pending',
					score: 0,
					moderationReason: null,
					moderationRule: null,
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
			]
		},
		replyCounts: { c1: 2 },
		mutedUntil: null
	};
	const NOTHING: OwnProfile = {
		notPublic: { comments: [], reports: [] },
		replyCounts: {},
		mutedUntil: null
	};
	const menus = () => screen.queryAllByRole('button', { name: /More actions on the comment/ });
	const tabNames = () => screen.getAllByRole('tab').map((t) => t.textContent?.trim());

	afterEach(() => session.clear());

	it('shows a visitor no owner actions and never asks for the private view', () => {
		const fetcher = vi.fn();
		vi.stubGlobal('fetch', fetcher);
		session.set({ ...ANNA, id: 'bea-id', username: 'bea', displayName: 'bea' });
		mount();
		expect(screen.queryByRole('button', { name: 'Edit profile' })).toBeNull();
		expect(screen.queryByRole('link', { name: 'Settings' })).toBeNull();
		expect(fetcher).not.toHaveBeenCalledWith('/api/me/profile', expect.anything());
		expect(menus()).toHaveLength(0);
	});

	it('gives the owner Edit profile and Settings', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn(async () => Response.json(OWN))
		);
		session.set(ANNA);
		mount();
		expect(screen.getByRole('link', { name: 'Settings' }).getAttribute('href')).toBe(
			'/user/settings'
		);
		expect(screen.getByRole('button', { name: 'Edit profile' })).toBeTruthy();
	});

	it('shows the owner exactly what a visitor sees until the private view is ready', async () => {
		let release: (response: Response) => void = () => {};
		const fetcher = vi.fn(() => new Promise<Response>((resolve) => (release = resolve)));
		vi.stubGlobal('fetch', fetcher);
		session.set(ANNA);
		mount();
		await waitFor(() => expect(fetcher).toHaveBeenCalledWith('/api/me/profile', expect.anything()));
		expect(tabNames()).toEqual(['Comments', 'Community reports']);
		expect(screen.getByText('Text of c1')).toBeTruthy();
		expect(menus()).toHaveLength(0);
		release(Response.json(OWN));
		await waitFor(() => expect(menus()).toHaveLength(2));
		// The public rows are still there, now with their menu; nothing was swapped.
		expect(screen.getByText('Text of c1')).toBeTruthy();
		expect(screen.getByText('Text of c2')).toBeTruthy();
		expect(screen.queryByText('Waiting text')).toBeNull();
		expect(tabNames()).toEqual(['Comments', 'Community reports', 'Not public']);
	});

	it('keeps the public lists in both tabs and puts the rest under Not public', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn(async () => Response.json(OWN))
		);
		session.set(ANNA);
		mount();
		await screen.findByRole('tab', { name: 'Not public' });
		await fireEvent.click(screen.getByRole('tab', { name: 'Community reports' }));
		expect(screen.getByRole('link', { name: 'Dark' })).toBeTruthy();
		expect(screen.queryByText('Waiting for review')).toBeNull();
		await fireEvent.click(screen.getByRole('tab', { name: 'Not public' }));
		const panel = screen.getByRole('tabpanel');
		expect(panel.getAttribute('aria-labelledby')).toBe('tab-notPublic');
		expect([...panel.querySelectorAll('h2')].map((h) => h.textContent)).toEqual([
			'Comments',
			'Community reports'
		]);
		expect(screen.getByText('Waiting text')).toBeTruthy();
		expect(screen.getByText('Awaiting review')).toBeTruthy();
		expect(screen.getByText('Waiting for review')).toBeTruthy();
		expect(screen.queryByText('Text of c1')).toBeNull();
	});

	it('names only the group that has items under Not public', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn(async () =>
				Response.json({ ...OWN, notPublic: { ...OWN.notPublic, reports: [] } } satisfies OwnProfile)
			)
		);
		session.set(ANNA);
		mount();
		await fireEvent.click(await screen.findByRole('tab', { name: 'Not public' }));
		expect(
			[...screen.getByRole('tabpanel').querySelectorAll('h2')].map((h) => h.textContent)
		).toEqual(['Comments']);
	});

	it('adds no third tab for an owner with nothing unpublished, and still adds the menus', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn(async () => Response.json(NOTHING))
		);
		session.set(ANNA);
		mount();
		await waitFor(() => expect(menus()).toHaveLength(2));
		expect(tabNames()).toEqual(['Comments', 'Community reports']);
	});

	it('moves between three tabs with the arrow keys, Home and End, and wraps', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn(async () => Response.json(OWN))
		);
		session.set(ANNA);
		mount();
		await screen.findByRole('tab', { name: 'Not public' });
		const selected = () =>
			screen.getAllByRole('tab').find((t) => t.getAttribute('aria-selected') === 'true')?.id;
		const press = async (key: string) => {
			await fireEvent.keyDown(document.getElementById(selected()!)!, { key });
			await waitFor(() => expect(document.activeElement?.id).toBe(selected()));
		};
		await press('ArrowRight');
		expect(selected()).toBe('tab-reports');
		await press('ArrowRight');
		expect(selected()).toBe('tab-notPublic');
		await press('ArrowRight');
		expect(selected()).toBe('tab-comments');
		await press('ArrowLeft');
		expect(selected()).toBe('tab-notPublic');
		await press('Home');
		expect(selected()).toBe('tab-comments');
		await press('End');
		expect(selected()).toBe('tab-notPublic');
		const tabs = screen.getAllByRole('tab');
		expect(tabs.map((t) => t.getAttribute('aria-controls'))).toEqual([
			null,
			null,
			'panel-notPublic'
		]);
		expect(tabs.map((t) => t.getAttribute('tabindex'))).toEqual(['-1', '-1', '0']);
		expect(screen.getByRole('tabpanel').id).toBe('panel-notPublic');
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

	it('names a mute, and says when the private view did not load while the public page stays whole', async () => {
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
		expect(tabNames()).toEqual(['Comments', 'Community reports']);
		expect(screen.getByText('Text of c1')).toBeTruthy();
		expect(menus()).toHaveLength(0);
	});

	it('edits and deletes a public row in place', async () => {
		const fetcher = vi.fn(async (input: string, init?: RequestInit) => {
			if (input === '/api/me/profile') return Response.json(OWN);
			if (init?.method === 'PATCH')
				return Response.json({
					comment: {
						id: 'c1',
						body: 'Changed',
						status: 'pending',
						moderationReason: null,
						moderationRule: null,
						editedAt: '2026-11-03T10:00:00.000Z'
					}
				});
			return Response.json({ ok: true });
		});
		vi.stubGlobal('fetch', fetcher);
		session.set(ANNA);
		mount();
		await waitFor(() => expect(menus()).toHaveLength(2));
		await fireEvent.click(menus()[0]);
		await fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
		await fireEvent.input(screen.getByRole('textbox', { name: 'Edit comment' }), {
			target: { value: 'Changed' }
		});
		await fireEvent.click(screen.getByRole('button', { name: 'Save' }));
		expect(await screen.findByText('Changed')).toBeTruthy();
		expect(screen.getByText('Awaiting review')).toBeTruthy();
		expect(screen.getByText('Text of c2')).toBeTruthy();

		await fireEvent.click(menus()[1]);
		await fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
		await fireEvent.click(screen.getByRole('button', { name: 'Delete comment' }));
		expect(await screen.findByText('Deleted')).toBeTruthy();
		expect(screen.getByText('Text of c2')).toBeTruthy();
		expect(fetcher).toHaveBeenCalledWith(
			'/api/comments/c2',
			expect.objectContaining({ method: 'DELETE' })
		);
	});

	it('names the replies a delete leaves under a placeholder, from the owner’s reply counts', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn(async () => Response.json(OWN))
		);
		session.set(ANNA);
		mount();
		await waitFor(() => expect(menus()).toHaveLength(2));
		await fireEvent.click(menus()[0]);
		await fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
		expect(screen.getByText(/Replies stay under a placeholder/)).toBeTruthy();
	});
});
