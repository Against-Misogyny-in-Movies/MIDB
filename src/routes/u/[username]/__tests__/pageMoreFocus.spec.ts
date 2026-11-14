import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ProfileComment, PublicProfile } from '#lib/media/types/profile.ts';

const { default: Page } = await import('../+page.svelte');
const { toasts } = await import('#lib/media/utils/toasts.svelte.js');

const entry = (id: string): ProfileComment => ({
	id,
	body: `Text of ${id}`,
	score: 0,
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
	scoreTotal: 0,
	commentCount: 0,
	comments: { comments: [entry('c1')], nextCursor: '99.c1' },
	reports: []
};

let fetcher: ReturnType<typeof vi.fn>;

beforeEach(() => {
	fetcher = vi.fn();
	vi.stubGlobal('fetch', fetcher);
});

afterEach(() => {
	cleanup();
	toasts.clear();
	vi.unstubAllGlobals();
});

describe('focus after showing more comments', () => {
	it('moves to the first new comment', async () => {
		fetcher.mockResolvedValue(
			Response.json({ comments: [entry('c2'), entry('c3')], nextCursor: null })
		);
		render(Page, { data: { profile: PROFILE } } as never);
		await fireEvent.click(screen.getByRole('button', { name: 'Show more comments' }));
		await waitFor(() => expect(document.activeElement?.id).toBe('profile-comment-c2'));
	});

	it('returns to the button when the load failed, and the toast names the reason', async () => {
		fetcher.mockResolvedValue(Response.json({ message: 'x' }, { status: 429 }));
		render(Page, { data: { profile: PROFILE } } as never);
		const button = screen.getByRole('button', { name: 'Show more comments' });
		await fireEvent.click(button);
		await waitFor(() => expect(document.activeElement).toBe(button));
		expect(toasts.items.map((t) => t.text)).toEqual([
			'More comments could not be loaded. Too many requests: wait a moment and try again.'
		]);
	});
});
