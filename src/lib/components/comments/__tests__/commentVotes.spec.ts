import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CommentView } from '#lib/media/types/comments.ts';
import type { PublicUser } from '#lib/media/types/user.ts';

vi.mock('$app/env', () => ({ browser: true }));

const { default: CommentsSection } = await import('../commentsSection.svelte');
const { session } = await import('#lib/media/utils/session.svelte.js');
const { toasts } = await import('#lib/media/utils/toasts.svelte.js');

const ME: PublicUser = {
	id: 'me',
	username: 'mary',
	avatarKey: null,
	role: 'user',
	displayName: 'mary'
};
const ANNA: PublicUser = { ...ME, id: 'anna', username: 'anna', displayName: 'anna' };

const comment: CommentView = {
	id: 'a',
	parentId: null,
	rootId: null,
	inReplyTo: null,
	removed: false,
	body: 'Text of a',
	author: ANNA,
	score: 12,
	replyCount: 0,
	createdAt: '2026-11-01T10:00:00.000Z',
	editedAt: null,
	replies: []
};

const json = (body: unknown, status = 200) =>
	new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

const LIST = '/api/titles/movie/603/comments';

function mount(viewer: () => Response | Promise<Response>, put?: () => Response) {
	const fetcher = vi.fn(async (input: string) => {
		const path = input.split('?')[0];
		if (path === LIST) return json({ comments: [comment], nextCursor: null });
		if (path === `${LIST}/viewer`) return viewer();
		if (path === '/api/comments/a/vote' && put) return put();
		return json({ message: 'Not found' }, 404);
	});
	return render(CommentsSection, { kind: 'movie', tmdbId: '603', fetcher });
}

const empty = () =>
	json({ votes: {}, scores: {}, comments: [], mutedUntil: null, votesOpenAt: null });

beforeEach(() => {
	document.cookie = 'midb_hint=; max-age=0; path=/';
	session.set(ME);
});

afterEach(() => {
	cleanup();
	session.clear();
	toasts.clear();
});

describe('Comment votes', () => {
	it('points both vote buttons at the score and reserves its width', async () => {
		mount(empty);
		const up = await screen.findByRole('button', { name: 'Upvote' });
		const down = screen.getByRole('button', { name: 'Downvote' });
		const score = document.getElementById('score-a');
		expect(score?.textContent).toContain('12');
		expect(up.getAttribute('aria-describedby')).toBe('score-a');
		expect(down.getAttribute('aria-describedby')).toBe('score-a');
		expect(score?.classList.contains('score')).toBe(true);
	});

	it('keeps the vote buttons disabled when the viewer state failed to load', async () => {
		mount(() => json({ message: 'Server error' }, 500));
		const failed = await screen.findByRole('button', { name: 'Upvote' });
		await screen.findByText(/could not be loaded/);
		expect((failed as HTMLButtonElement).disabled).toBe(true);
	});

	it('sets the status line from the reader’s press, not from the server answer', async () => {
		mount(empty, () => json({ score: 40, vote: 1 }));
		await screen.findByRole('button', { name: 'Upvote' });
		const status = document.querySelector('[data-vote-status]') as HTMLElement;
		const up = await screen.findByRole('button', { name: 'Upvote' });
		await waitFor(() => expect((up as HTMLButtonElement).disabled).toBe(false));
		expect(status.textContent).toBe('');
		await fireEvent.click(up);
		expect(status.textContent).toBe('Score 13');
		await waitFor(() => expect(document.getElementById('score-a')?.textContent).toContain('40'));
		expect(status.textContent).toBe('Score 13');
	});

	it('names the comment in a failed vote toast', async () => {
		mount(empty, () => json({ message: 'Server error' }, 500));
		const up = await screen.findByRole('button', { name: 'Upvote' });
		await waitFor(() => expect((up as HTMLButtonElement).disabled).toBe(false));
		await fireEvent.click(up);
		await waitFor(() =>
			expect(toasts.items.map((t) => t.text)).toEqual([
				'The vote on anna’s comment was not saved. Try again in a moment.'
			])
		);
	});

	it('locks the votes of a new account until they open, and says when', async () => {
		const at = new Date(Date.now() + 3 * 86_400_000).toISOString();
		mount(() => json({ votes: {}, scores: {}, comments: [], mutedUntil: null, votesOpenAt: at }));
		const up = await screen.findByRole('button', { name: 'Upvote' });
		const group = screen.getByRole('group', { name: 'Vote on this comment' });
		await waitFor(() => expect(group.getAttribute('title')).toMatch(/^Votes open on .+\.$/));
		expect((up as HTMLButtonElement).disabled).toBe(true);
		expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Downvote' }).disabled).toBe(true);
		expect(document.getElementById(group.getAttribute('aria-describedby') ?? '')?.textContent).toBe(
			group.getAttribute('title')
		);
	});

	it('leaves the votes open once the date has passed', async () => {
		const at = new Date(Date.now() - 1000).toISOString();
		mount(() => json({ votes: {}, scores: {}, comments: [], mutedUntil: null, votesOpenAt: at }));
		const up = await screen.findByRole('button', { name: 'Upvote' });
		await waitFor(() => expect((up as HTMLButtonElement).disabled).toBe(false));
		expect(screen.getByRole('group', { name: 'Vote on this comment' }).hasAttribute('title')).toBe(
			false
		);
	});
});
