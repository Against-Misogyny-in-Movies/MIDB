import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CommentView, ViewerCommentState } from '#lib/media/types/comments.ts';
import type { PublicUser } from '#lib/media/types/user.ts';

/** Opens the comment's menu and returns its item with this name. */
async function menuItem(scope: HTMLElement, name: string): Promise<HTMLElement> {
	await fireEvent.click(within(scope).getByRole('button', { name: /^More actions/ }));
	return within(scope).getByRole('button', { name });
}

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
	return () => json({ votes: {}, scores: {}, comments: [], mutedUntil: null, ...state });
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

describe('CommentsSection, the comment menu', () => {
	beforeEach(() => session.set(ME));

	it('moves the focus into a delete opened from the menu, and back to the menu on Keep comment', async () => {
		mount(
			api({
				[`GET ${LIST}`]: list([view('mine', { author: ME, body: 'My words' })]),
				[`GET ${LIST}/viewer`]: viewer()
			})
		);
		await screen.findByText('My words');
		const mine = document.getElementById('comment-mine')!;
		await fireEvent.click(await menuItem(mine, 'Delete'));
		await waitFor(() =>
			expect(document.activeElement?.textContent).toMatch(/Other readers no longer see its text/)
		);
		await fireEvent.click(screen.getByRole('button', { name: 'Keep comment' }));
		await waitFor(() =>
			expect(document.activeElement).toBe(
				within(mine).getByRole('button', { name: /^More actions/ })
			)
		);
	});

	it('moves the focus to the first reason of a report opened from the menu', async () => {
		mount(
			api({
				[`GET ${LIST}`]: list([view('a')]),
				[`GET ${LIST}/viewer`]: viewer()
			})
		);
		await screen.findByText('Text of a');
		await fireEvent.click(await menuItem(document.getElementById('comment-a')!, 'Report'));
		await waitFor(() => expect(document.activeElement?.getAttribute('type')).toBe('radio'));
	});

	it("copies the comment's full address with Copy link, and its date is not a link", async () => {
		const writeText = vi.fn(async () => {});
		Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
		mount(
			api({
				[`GET ${LIST}`]: list([view('a')]),
				[`GET ${LIST}/viewer`]: viewer()
			})
		);
		await screen.findByText('Text of a');
		const item = document.getElementById('comment-a')!;
		expect(item.querySelector('time')?.closest('a')).toBeNull();
		await fireEvent.click(within(item).getByRole('button', { name: 'Copy link' }));
		await waitFor(() =>
			expect(writeText).toHaveBeenCalledWith(new URL('/movie/603#comment-a', location.href).href)
		);
		expect(toasts.items.map((t) => t.text)).toEqual(['Link copied.']);
	});
});
