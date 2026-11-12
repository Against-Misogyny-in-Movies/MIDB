import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CommentView, OwnComment, ViewerCommentState } from '#lib/media/types/comments.ts';
import type { PublicUser } from '#lib/media/types/user.ts';

vi.mock('$app/env', () => ({ browser: true }));

const { default: CommentsSection } = await import('../commentsSection.svelte');
const { session } = await import('#lib/media/utils/session.svelte.js');

const ME: PublicUser = {
	id: 'me',
	username: 'mary',
	avatarKey: null,
	role: 'user',
	displayName: 'mary'
};
const ANNA: PublicUser = { ...ME, id: 'anna', username: 'anna', displayName: 'anna' };

function view(id: string, over: Partial<CommentView> = {}): CommentView {
	return {
		id,
		parentId: null,
		rootId: null,
		inReplyTo: null,
		removed: false,
		body: `Text of ${id}`,
		author: ANNA,
		score: 3,
		replyCount: 0,
		createdAt: '2026-11-01T10:00:00.000Z',
		editedAt: null,
		replies: [],
		...over
	};
}

function own(id: string, over: Partial<OwnComment> = {}): OwnComment {
	return {
		id,
		parentId: null,
		rootId: null,
		body: `Own ${id}`,
		status: 'pending',
		moderationSource: null,
		moderationReason: null,
		score: 0,
		replyCount: 0,
		createdAt: '2026-11-02T10:00:00.000Z',
		editedAt: null,
		...over
	};
}

type Handler = (init?: RequestInit) => Response | Promise<Response>;

const json = (body: unknown, status = 200) =>
	new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

/** A fetcher answering by "METHOD path"; anything else is a 404 so a stray call fails loudly. */
function api(routes: Record<string, Handler>) {
	return vi.fn(async (input: string, init?: RequestInit) => {
		const path = input.split('?')[0];
		const handler = routes[`${init?.method ?? 'GET'} ${path}`];
		return handler ? handler(init) : json({ message: 'Not found' }, 404);
	});
}

const LIST = '/api/titles/movie/603/comments';

function mount(fetcher: ReturnType<typeof api>) {
	return render(CommentsSection, { kind: 'movie', tmdbId: '603', fetcher });
}

const viewer = (state: Partial<ViewerCommentState> = {}): Handler => {
	return () => json({ votes: {}, comments: [], mutedUntil: null, ...state });
};

const list = (comments: CommentView[], nextCursor: string | null = null): Handler => {
	return () => json({ comments, nextCursor });
};

beforeEach(() => {
	document.cookie = 'midb_hint=; max-age=0; path=/';
});

afterEach(() => {
	cleanup();
	session.clear();
});

describe('CommentsSection signed out', () => {
	beforeEach(() => session.clear());

	it('reserves a busy box while loading, then fills it', async () => {
		const fetcher = api({ [`GET ${LIST}`]: list([view('a')]) });
		const { container } = mount(fetcher);
		const slot = container.querySelector('.slot')!;
		expect(slot.getAttribute('aria-busy')).toBe('true');
		expect(await screen.findByText('Text of a')).toBeTruthy();
		expect(slot.getAttribute('aria-busy')).toBe('false');
	});

	it('offers sign-in and shows no composer and no vote controls', async () => {
		mount(api({ [`GET ${LIST}`]: list([view('a')]) }));
		await screen.findByText('Text of a');
		const link = screen.getByRole('link', { name: 'Sign in to comment' });
		expect(link.getAttribute('href')).toBe('/auth?next=%2Fmovie%2F603');
		expect(screen.queryByRole('textbox')).toBeNull();
		expect(screen.queryByRole('button', { name: 'Upvote' })).toBeNull();
		expect(screen.queryByRole('button', { name: 'Report' })).toBeNull();
	});

	it('shows the empty state and hides the sort chips', async () => {
		mount(api({ [`GET ${LIST}`]: list([]) }));
		expect(await screen.findByText('No comments yet.')).toBeTruthy();
		expect(document.querySelector('.toolbar')?.className).toMatch(/toolbar--hidden/);
	});

	it('keeps the sort chips while comments are listed', async () => {
		mount(api({ [`GET ${LIST}`]: list([view('a')]) }));
		await screen.findByText('Text of a');
		expect(document.querySelector('.toolbar')?.className).not.toMatch(/toolbar--hidden/);
	});

	it('says what failed to load and retries', async () => {
		let fail = true;
		const fetcher = api({
			[`GET ${LIST}`]: () =>
				fail ? json({ message: 'x' }, 500) : json({ comments: [], nextCursor: null })
		});
		mount(fetcher);
		const alert = await screen.findByRole('alert');
		expect(alert.textContent).toMatch(/comments could not be loaded/i);
		fail = false;
		await fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
		expect(await screen.findByText('No comments yet.')).toBeTruthy();
	});

	it('renders a removed comment as a placeholder above its replies, and names whom a reply answers', async () => {
		const reply = view('r', {
			parentId: 'a',
			rootId: 'a',
			body: 'A reply',
			inReplyTo: { id: 'x', displayName: 'bea' }
		});
		mount(
			api({
				[`GET ${LIST}`]: list([
					view('a', { removed: true, body: null, author: null, replyCount: 1, replies: [reply] })
				])
			})
		);
		expect(await screen.findByText('This comment was removed.')).toBeTruthy();
		expect(screen.getByText('A reply')).toBeTruthy();
		expect(screen.getByText('In reply to bea')).toBeTruthy();
	});

	it('loads the next page on request', async () => {
		const fetcher = vi
			.fn()
			.mockResolvedValueOnce(json({ comments: [view('a')], nextCursor: 'next' }))
			.mockResolvedValueOnce(json({ comments: [view('b')], nextCursor: null }));
		mount(fetcher as never);
		await screen.findByText('Text of a');
		await fireEvent.click(screen.getByRole('button', { name: 'Show more comments' }));
		expect(await screen.findByText('Text of b')).toBeTruthy();
		expect(screen.queryByRole('button', { name: 'Show more comments' })).toBeNull();
	});

	it('moves the focus to the first new comment after Show more', async () => {
		const fetcher = vi
			.fn()
			.mockResolvedValueOnce(json({ comments: [view('a')], nextCursor: 'next' }))
			.mockResolvedValueOnce(json({ comments: [view('b')], nextCursor: null }));
		mount(fetcher as never);
		await screen.findByText('Text of a');
		await fireEvent.click(screen.getByRole('button', { name: 'Show more comments' }));
		await screen.findByText('Text of b');
		await waitFor(() => expect(document.activeElement?.id).toBe('comment-b'));
	});
});

describe('CommentsSection signed in', () => {
	beforeEach(() => session.set(ME));

	it('merges the reader’s pending and rejected comments, with their badges and reason', async () => {
		mount(
			api({
				[`GET ${LIST}`]: list([view('a')]),
				[`GET ${LIST}/viewer`]: viewer({
					comments: [
						own('p'),
						own('q', { status: 'rejected', moderationReason: 'Contains a slur' })
					]
				})
			})
		);
		expect(await screen.findByText('Own p')).toBeTruthy();
		expect(screen.getByText('Awaiting review')).toBeTruthy();
		expect(screen.getByText('Rejected')).toBeTruthy();
		expect(screen.getByText(/Rejected: Contains a slur\. Only the author/)).toBeTruthy();
	});

	it('has no vote or report controls on the reader’s own comment, and edit and delete on it only', async () => {
		mount(
			api({
				[`GET ${LIST}`]: list([view('mine', { author: ME, body: 'My words' }), view('a')]),
				[`GET ${LIST}/viewer`]: viewer()
			})
		);
		await screen.findByText('My words');
		const mine = document.getElementById('comment-mine')!;
		expect(mine.querySelector('[aria-label="Upvote"]')).toBeNull();
		expect(mine.textContent).toMatch(/Edit/);
		expect(mine.textContent).toMatch(/Delete/);
		expect(mine.textContent).not.toMatch(/Report/);
		const other = document.getElementById('comment-a')!;
		expect(other.querySelector('[aria-label="Upvote"]')).toBeTruthy();
		expect(other.textContent).toMatch(/Report/);
		expect(other.textContent).not.toMatch(/Edit/);
	});

	it('posts a comment and shows it as awaiting review', async () => {
		const post = vi.fn(() => json({ comment: own('new', { body: 'Hello there' }) }, 201));
		mount(
			api({
				[`GET ${LIST}`]: list([]),
				[`GET ${LIST}/viewer`]: viewer(),
				[`POST ${LIST}`]: post
			})
		);
		const field = await screen.findByRole('textbox', { name: 'Write a comment' });
		await fireEvent.input(field, { target: { value: '  Hello there ' } });
		await fireEvent.click(screen.getByRole('button', { name: 'Comment' }));
		expect(await screen.findByText('Hello there')).toBeTruthy();
		expect(post).toHaveBeenCalledWith(
			expect.objectContaining({ body: JSON.stringify({ body: 'Hello there' }) })
		);
		expect(screen.getByText('Awaiting review')).toBeTruthy();
		expect(screen.getByRole('status').textContent).toBe(
			'Comment sent. Only the author and moderators see the comment until a moderator decides.'
		);
	});

	it('keeps the field read-only and names the check while it runs, then keeps the text on failure', async () => {
		let release!: () => void;
		const gate = new Promise<void>((r) => (release = r));
		mount(
			api({
				[`GET ${LIST}`]: list([]),
				[`GET ${LIST}/viewer`]: viewer(),
				[`POST ${LIST}`]: async () => {
					await gate;
					return json({ message: 'Server error' }, 500);
				}
			})
		);
		const field = await screen.findByRole('textbox', { name: 'Write a comment' });
		await fireEvent.input(field, { target: { value: 'My draft' } });
		await fireEvent.click(screen.getByRole('button', { name: 'Comment' }));

		const busyButton = await screen.findByRole('button', { name: 'Checking…' });
		expect((busyButton as HTMLButtonElement).disabled).toBe(true);
		expect((field as HTMLTextAreaElement).readOnly).toBe(true);
		expect(field.closest('form')?.getAttribute('aria-busy')).toBe('true');
		expect(screen.getByText('Checking the comment…').closest('[aria-live="polite"]')).toBeTruthy();

		release();
		await screen.findByRole('alert');
		expect((field as HTMLTextAreaElement).readOnly).toBe(false);
		expect((field as HTMLTextAreaElement).value).toBe('My draft');
		expect(field.closest('form')?.getAttribute('aria-busy')).toBe('false');
	});

	it('shows a just-published comment at once, once, and warns on a rejection with the reason first', async () => {
		const published = own('new', { body: 'Fresh', status: 'published' });
		const posts = [
			json({ comment: published }, 201),
			json(
				{
					comment: own('no', {
						body: 'Bad',
						status: 'rejected',
						moderationReason: 'Attacks a person.'
					})
				},
				201
			)
		];
		mount(
			api({
				[`GET ${LIST}`]: list([view('a')]),
				[`GET ${LIST}/viewer`]: viewer(),
				[`POST ${LIST}`]: () => posts.shift() as Response
			})
		);
		const field = await screen.findByRole('textbox', { name: 'Write a comment' });
		await fireEvent.input(field, { target: { value: 'Fresh' } });
		await fireEvent.click(screen.getByRole('button', { name: 'Comment' }));
		expect(await screen.findByText('Fresh')).toBeTruthy();
		expect(screen.getAllByText('Fresh')).toHaveLength(1);
		expect(screen.getByRole('status').textContent).toBe('Comment posted.');
		expect(screen.queryByText('Awaiting review')).toBeNull();

		await fireEvent.input(field, { target: { value: 'Bad' } });
		await fireEvent.click(screen.getByRole('button', { name: 'Comment' }));
		await waitFor(() =>
			expect(screen.getAllByRole('status').map((n) => n.textContent)).toContain(
				'Rejected: Attacks a person. Only the author and moderators see the comment.'
			)
		);
	});

	it('names a muted account when a write is refused', async () => {
		mount(
			api({
				[`GET ${LIST}`]: list([]),
				[`GET ${LIST}/viewer`]: viewer(),
				[`POST ${LIST}`]: () => json({ message: 'Account muted' }, 403)
			})
		);
		const field = await screen.findByRole('textbox', { name: 'Write a comment' });
		await fireEvent.input(field, { target: { value: 'Hi' } });
		await fireEvent.click(screen.getByRole('button', { name: 'Comment' }));
		expect((await screen.findByRole('alert')).textContent).toMatch(/muted/);
	});

	it('says when the rate limit stops a write', async () => {
		mount(
			api({
				[`GET ${LIST}`]: list([]),
				[`GET ${LIST}/viewer`]: viewer(),
				[`POST ${LIST}`]: () => json({ message: 'Too many requests' }, 429)
			})
		);
		const field = await screen.findByRole('textbox', { name: 'Write a comment' });
		await fireEvent.input(field, { target: { value: 'Hi' } });
		await fireEvent.click(screen.getByRole('button', { name: 'Comment' }));
		expect((await screen.findByRole('alert')).textContent).toMatch(/Too many requests/);
	});

	it('shows the reader’s vote and updates the score from the response', async () => {
		const put = vi.fn(() => json({ score: 4, vote: -1 }));
		mount(
			api({
				[`GET ${LIST}`]: list([view('a')]),
				[`GET ${LIST}/viewer`]: viewer({ votes: { a: 1 } }),
				'PUT /api/comments/a/vote': put
			})
		);
		const up = await screen.findByRole('button', { name: 'Upvote' });
		await waitFor(() => expect(up.getAttribute('aria-pressed')).toBe('true'));
		const down = screen.getByRole('button', { name: 'Downvote' });
		await fireEvent.click(down);
		await waitFor(() => expect(down.getAttribute('aria-pressed')).toBe('true'));
		expect(up.getAttribute('aria-pressed')).toBe('false');
		expect(document.querySelector('#comment-a .score')?.textContent).toBe('Score 4');
	});

	it('names what is lost before a delete, then keeps a comment with replies as a placeholder', async () => {
		const reply = view('r', { parentId: 'mine', rootId: 'mine', body: 'A reply' });
		const del = vi.fn(() => json({ ok: true }));
		mount(
			api({
				[`GET ${LIST}`]: list([
					view('mine', { author: ME, body: 'My words', replyCount: 1, replies: [reply] })
				]),
				[`GET ${LIST}/viewer`]: viewer(),
				'DELETE /api/comments/mine': del
			})
		);
		await screen.findByText('My words');
		const mine = document.getElementById('comment-mine')!;
		const deleteButton = [...mine.querySelectorAll('button')].find(
			(b) => b.textContent?.trim() === 'Delete'
		)!;
		await fireEvent.click(deleteButton);
		expect(mine.textContent).toMatch(/Other readers no longer see its text/);
		expect(mine.textContent).toMatch(/Replies stay under a placeholder/);
		await fireEvent.click(screen.getByRole('button', { name: 'Delete comment' }));
		expect(await screen.findByText('This comment was removed.')).toBeTruthy();
		expect(screen.getByText('A reply')).toBeTruthy();
		expect(del).toHaveBeenCalledOnce();
	});

	it('sends a report with its reason and note', async () => {
		const report = vi.fn(() => json({ alreadyReported: false }, 201));
		mount(
			api({
				[`GET ${LIST}`]: list([view('a')]),
				[`GET ${LIST}/viewer`]: viewer(),
				'POST /api/comments/a/report': report
			})
		);
		await screen.findByText('Text of a');
		await fireEvent.click(screen.getByRole('button', { name: 'Report' }));
		const send = screen.getByRole('button', { name: 'Send report' }) as HTMLButtonElement;
		expect(send.disabled).toBe(true);
		await fireEvent.click(screen.getByLabelText('Spam'));
		await fireEvent.input(screen.getByLabelText('Note (optional)'), { target: { value: 'Ad' } });
		await fireEvent.click(send);
		expect((await screen.findByRole('status')).textContent).toMatch(/Report sent/);
		expect(report).toHaveBeenCalledWith(
			expect.objectContaining({ body: JSON.stringify({ reason: 'spam', note: 'Ad' }) })
		);
	});

	it('edits the reader’s comment in place and says moderation runs again', async () => {
		const patch = vi.fn(() => json({ comment: own('mine', { body: 'Changed' }) }));
		mount(
			api({
				[`GET ${LIST}`]: list([view('mine', { author: ME, body: 'My words' })]),
				[`GET ${LIST}/viewer`]: viewer(),
				'PATCH /api/comments/mine': patch
			})
		);
		await screen.findByText('My words');
		const mine = document.getElementById('comment-mine')!;
		await fireEvent.click(
			[...mine.querySelectorAll('button')].find((b) => b.textContent?.trim() === 'Edit')!
		);
		expect(screen.getByText('Saving runs moderation again.')).toBeTruthy();
		const field = screen.getByRole('textbox', { name: 'Edit comment' });
		await fireEvent.input(field, { target: { value: 'Changed' } });
		await fireEvent.click(screen.getByRole('button', { name: 'Save' }));
		await waitFor(() => expect(patch).toHaveBeenCalledOnce());
		expect(await screen.findByText('Awaiting review')).toBeTruthy();
	});

	it('puts the focus on the placeholder after a delete that leaves one', async () => {
		const reply = view('r', { parentId: 'mine', rootId: 'mine', body: 'A reply' });
		mount(
			api({
				[`GET ${LIST}`]: list([
					view('mine', { author: ME, body: 'My words', replyCount: 1, replies: [reply] })
				]),
				[`GET ${LIST}/viewer`]: viewer(),
				'DELETE /api/comments/mine': () => json({ ok: true })
			})
		);
		await screen.findByText('My words');
		const mine = document.getElementById('comment-mine')!;
		await fireEvent.click(
			[...mine.querySelectorAll('button')].find((b) => b.textContent?.trim() === 'Delete')!
		);
		await fireEvent.click(screen.getByRole('button', { name: 'Delete comment' }));
		await screen.findByText('This comment was removed.');
		await waitFor(() => expect(document.activeElement?.id).toBe('comment-mine'));
		expect(mine.textContent).not.toMatch(/Other readers no longer see its text/);
	});

	it('puts the focus on the next comment after a delete that removes the comment', async () => {
		mount(
			api({
				[`GET ${LIST}`]: list([view('mine', { author: ME, body: 'My words' }), view('a')]),
				[`GET ${LIST}/viewer`]: viewer(),
				'DELETE /api/comments/mine': () => json({ ok: true })
			})
		);
		await screen.findByText('My words');
		const mine = document.getElementById('comment-mine')!;
		await fireEvent.click(
			[...mine.querySelectorAll('button')].find((b) => b.textContent?.trim() === 'Delete')!
		);
		await fireEvent.click(screen.getByRole('button', { name: 'Delete comment' }));
		await waitFor(() => expect(document.getElementById('comment-mine')).toBeNull());
		await waitFor(() => expect(document.activeElement?.id).toBe('comment-a'));
	});

	it('puts the focus on Close once a report is sent', async () => {
		mount(
			api({
				[`GET ${LIST}`]: list([view('a')]),
				[`GET ${LIST}/viewer`]: viewer(),
				'POST /api/comments/a/report': () => json({ alreadyReported: false }, 201)
			})
		);
		await screen.findByText('Text of a');
		await fireEvent.click(screen.getByRole('button', { name: 'Report' }));
		await fireEvent.click(screen.getByLabelText('Spam'));
		await fireEvent.click(screen.getByRole('button', { name: 'Send report' }));
		const close = await screen.findByRole('button', { name: 'Close' });
		await waitFor(() => expect(document.activeElement).toBe(close));
	});

	it('replaces the composer with the mute, and disables votes, replies and reports until it ends', async () => {
		const until = new Date(Date.now() + 86_400_000).toISOString();
		mount(
			api({
				[`GET ${LIST}`]: list([view('a')]),
				[`GET ${LIST}/viewer`]: viewer({ mutedUntil: until })
			})
		);
		await screen.findByText('Text of a');
		await waitFor(() =>
			expect(screen.getByRole('status').textContent).toMatch(/is muted and cannot/)
		);
		expect(screen.getByRole('status').textContent).toMatch(
			/write, edit, delete, vote on or report/
		);
		expect(screen.queryByRole('textbox')).toBeNull();
		for (const name of ['Upvote', 'Downvote', 'Reply', 'Report']) {
			expect(screen.getByRole('button', { name })).toHaveProperty('disabled', true);
		}
	});

	it('retries a failed viewer load with a secondary button', async () => {
		let fail = true;
		mount(
			api({
				[`GET ${LIST}`]: list([view('a')]),
				[`GET ${LIST}/viewer`]: () => (fail ? json({ message: 'x' }, 500) : viewer()())
			})
		);
		await screen.findByText(
			/votes and unpublished comments could not be loaded|could not be loaded/
		);
		const retry = screen.getByRole('button', { name: 'Try again' });
		expect(retry.className).toMatch(/btn--ink/);
		fail = false;
		await fireEvent.click(retry);
		await waitFor(() => expect(screen.queryByRole('alert')).toBeNull());
	});

	it('marks the field invalid only for a length error, and ties the message to it', async () => {
		let status = 400;
		mount(
			api({
				[`GET ${LIST}`]: list([]),
				[`GET ${LIST}/viewer`]: viewer(),
				[`POST ${LIST}`]: () => json({ message: 'x' }, status)
			})
		);
		const field = await screen.findByRole('textbox', { name: 'Write a comment' });
		await fireEvent.input(field, { target: { value: 'Hi' } });
		await fireEvent.click(screen.getByRole('button', { name: 'Comment' }));
		const alert = await screen.findByRole('alert');
		expect(field.getAttribute('aria-invalid')).toBe('true');
		expect(field.getAttribute('aria-describedby')).toBe(alert.id);
		status = 429;
		await fireEvent.click(screen.getByRole('button', { name: 'Comment' }));
		await waitFor(() => expect(screen.getByRole('alert').textContent).toMatch(/Too many/));
		expect(field.getAttribute('aria-invalid')).toBeNull();
		expect(field.getAttribute('aria-describedby')).toBe(screen.getByRole('alert').id);
	});

	it('keeps one primary button: a reply composer submits with the secondary one', async () => {
		mount(
			api({
				[`GET ${LIST}`]: list([view('a')]),
				[`GET ${LIST}/viewer`]: viewer()
			})
		);
		await screen.findByText('Text of a');
		await fireEvent.click(screen.getByRole('button', { name: 'Reply' }));
		expect(document.querySelectorAll('.btn--brand')).toHaveLength(1);
		const submit = document.querySelector('#comment-a button[type="submit"]')!;
		expect(submit.className).toMatch(/btn--ink/);
	});
});
