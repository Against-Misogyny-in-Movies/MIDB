import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { UserCommentRow } from '#lib/media/types/comments.ts';
import { toasts } from '#lib/media/utils/toasts.svelte.js';
import CommentHistoryRow from '../commentHistoryRow.svelte';

const row = (over: Partial<UserCommentRow> = {}): UserCommentRow => ({
	id: 'c1',
	body: 'My words',
	status: 'published',
	score: 4,
	moderationReason: null,
	parentId: null,
	replyCount: 0,
	createdAt: '2026-11-01T10:00:00.000Z',
	editedAt: null,
	kind: 'movie',
	tmdbId: 348,
	title: 'Alien',
	...over
});

const json = (body: unknown, status = 200) =>
	new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

afterEach(() => {
	cleanup();
	vi.unstubAllGlobals();
	toasts.clear();
});

function mount(comment: UserCommentRow) {
	// The row renders a list item, so it needs a list around it.
	const list = document.body.appendChild(document.createElement('ul'));
	return render(CommentHistoryRow, { props: { comment }, target: list });
}

describe('CommentHistoryRow', () => {
	it.each([
		['pending', 'Awaiting review'],
		['hidden', 'Hidden'],
		['rejected', 'Rejected'],
		['deleted', 'Deleted']
	] as const)('badges a %s comment', (status, label) => {
		mount(row({ status }));
		expect(screen.getByText(label)).toBeTruthy();
	});

	it('has no status badge on a published comment, and shows its score', () => {
		mount(row({ status: 'published' }));
		expect(screen.queryByText('Published')).toBeNull();
		expect(screen.getByText('Score 4')).toBeTruthy();
	});

	it('shows no score on a comment that is not published', () => {
		mount(row({ status: 'pending' }));
		expect(screen.queryByText(/Score/)).toBeNull();
	});

	it('links the title and says which comment is a reply', () => {
		mount(row({ parentId: 'p' }));
		expect(screen.getByRole('link', { name: 'Alien' }).getAttribute('href')).toBe('/movie/348');
		expect(screen.getByText('Reply')).toBeTruthy();
	});

	it('links to the comment on its title page with View comment, never its date', () => {
		mount(row());
		expect(screen.getByRole('link', { name: 'View comment' }).getAttribute('href')).toBe(
			'/movie/348#comment-c1'
		);
		expect(document.querySelector('time')?.closest('a')).toBeNull();
		cleanup();
		mount(row({ tmdbId: null }));
		expect(screen.queryByRole('link')).toBeNull();
	});

	it('shows the reason of a rejected comment and who hid a hidden one', () => {
		mount(row({ status: 'rejected', moderationReason: 'Contains a slur' }));
		expect(screen.getByText(/Rejected: Contains a slur\. Only the author/)).toBeTruthy();
		cleanup();
		mount(row({ status: 'hidden' }));
		expect(screen.getByText(/A moderator hid this comment/)).toBeTruthy();
	});

	it('offers neither edit nor delete on a deleted comment, and no edit on a hidden one', () => {
		mount(row({ status: 'deleted' }));
		expect(screen.queryByRole('button', { name: 'Edit' })).toBeNull();
		expect(screen.queryByRole('button', { name: 'Delete' })).toBeNull();
		cleanup();
		mount(row({ status: 'hidden' }));
		expect(screen.queryByRole('button', { name: 'Edit' })).toBeNull();
		expect(screen.getByRole('button', { name: 'Delete' })).toBeTruthy();
	});

	it('edits in place and shows the new status from the response', async () => {
		const fetchMock = vi.fn(async () =>
			json({
				comment: {
					id: 'c1',
					body: 'Changed',
					status: 'pending',
					moderationReason: null,
					editedAt: '2026-11-03T10:00:00.000Z'
				}
			})
		);
		vi.stubGlobal('fetch', fetchMock);
		mount(row());
		await fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
		await fireEvent.input(screen.getByRole('textbox', { name: 'Edit comment' }), {
			target: { value: 'Changed' }
		});
		await fireEvent.click(screen.getByRole('button', { name: 'Save' }));
		expect(await screen.findByText('Changed')).toBeTruthy();
		expect(screen.getByText('Awaiting review')).toBeTruthy();
		expect(fetchMock).toHaveBeenCalledWith(
			'/api/comments/c1',
			expect.objectContaining({ method: 'PATCH' })
		);
	});

	it('names what is lost before deleting, then marks the comment deleted', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn(async () => json({ ok: true }))
		);
		mount(row({ replyCount: 2 }));
		await fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
		expect(
			screen.getByText(
				/Other readers no longer see its text\. It stays here, marked as deleted\..*Replies stay under a placeholder/
			)
		).toBeTruthy();
		await fireEvent.click(screen.getByRole('button', { name: 'Delete comment' }));
		expect(await screen.findByText('Deleted')).toBeTruthy();
	});

	it('toasts a failed delete and keeps the comment as it was', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn(async () => json({ message: 'Account muted' }, 403))
		);
		mount(row());
		await fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
		await fireEvent.click(screen.getByRole('button', { name: 'Delete comment' }));
		await waitFor(() =>
			expect(toasts.items.map((t) => t.tone + ': ' + t.text)).toEqual([
				expect.stringMatching(/^error: .*muted/)
			])
		);
		expect(screen.queryByText('Deleted')).toBeNull();
		expect(screen.getByRole('button', { name: 'Delete' })).toBeTruthy();
	});
});
