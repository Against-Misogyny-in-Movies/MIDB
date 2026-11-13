import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CommentView, OwnComment, ViewerCommentState } from '#lib/media/types/comments.ts';
import type { PublicUser } from '#lib/media/types/user.ts';

vi.mock('$app/env', () => ({ browser: true }));

const { default: CommentsSection } = await import('../commentsSection.svelte');
const { session } = await import('#lib/media/utils/session.svelte.js');
const { toasts } = await import('#lib/media/utils/toasts.svelte.js');

/** The toasts showing, as `tone: text`. */
const shown = () => toasts.items.map((t) => `${t.tone}: ${t.text}`);

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
	toasts.clear();
});

describe('CommentsSection check', () => {
	beforeEach(() => session.set(ME));

	it('keeps the field read-only and the button busy while the check runs, then keeps the text on failure', async () => {
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

		const busyButton = screen.getByRole('button', { name: 'Comment' });
		await waitFor(() => expect(busyButton.getAttribute('aria-busy')).toBe('true'));
		expect((busyButton as HTMLButtonElement).disabled).toBe(true);
		expect((field as HTMLTextAreaElement).readOnly).toBe(true);
		expect(field.closest('form')?.getAttribute('aria-busy')).toBe('true');
		expect(screen.getByText('Checking the comment…').closest('[aria-live="polite"]')).toBeTruthy();

		release();
		await waitFor(() => expect(shown()).toEqual([expect.stringMatching(/^error: /)]));
		expect(busyButton.getAttribute('aria-busy')).toBe('false');
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
		expect(shown()).toEqual(['success: Comment posted.']);
		expect(screen.queryByText('Awaiting review')).toBeNull();

		await fireEvent.input(field, { target: { value: 'Bad' } });
		await fireEvent.click(screen.getByRole('button', { name: 'Comment' }));
		await waitFor(() =>
			expect(shown()).toContain(
				'warn: Rejected: Attacks a person. Only the author and moderators see the comment.'
			)
		);
	});
});
