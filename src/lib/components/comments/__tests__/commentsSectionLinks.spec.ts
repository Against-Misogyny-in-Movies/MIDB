import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CommentThread, CommentView } from '#lib/media/types/comments.ts';
import type { PublicUser } from '#lib/media/types/user.ts';

vi.mock('$app/env', () => ({ browser: true }));

const { default: CommentsSection } = await import('../commentsSection.svelte');
const { session } = await import('#lib/media/utils/session.svelte.js');

const ANNA: PublicUser = {
	id: 'anna',
	username: 'anna',
	avatarKey: null,
	role: 'user',
	displayName: 'anna'
};

const view = (id: string, over: Partial<CommentView> = {}): CommentView => ({
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
});

const json = (body: unknown, status = 200) =>
	new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

const LIST = '/api/titles/movie/603/comments';

/** Page one holds `first`; page two holds `second`; `GET /api/comments/<id>` answers from `threads`. */
function api(threads: Record<string, CommentThread> = {}) {
	return vi.fn(async (input: string) => {
		const [path, query = ''] = input.split('?');
		if (path === LIST) {
			return query.includes('cursor=')
				? json({ comments: [view('second')], nextCursor: null })
				: json({ comments: [view('first')], nextCursor: 'two' });
		}
		if (path.endsWith('/viewer')) {
			return json({ votes: {}, scores: {}, comments: [], mutedUntil: null });
		}
		const thread = threads[path.split('/').pop() as string];
		return thread ? json(thread) : json({ message: 'Not found' }, 404);
	});
}

const mount = (fetcher: ReturnType<typeof api>) =>
	render(CommentsSection, { kind: 'movie', tmdbId: '603', fetcher });
const threadCalls = (fetcher: ReturnType<typeof api>) =>
	fetcher.mock.calls.filter(([url]) => url.startsWith('/api/comments/')).map(([url]) => url);
const articles = (id: string) => document.querySelectorAll(`#comment-${id}`);

beforeEach(() => {
	session.clear();
	document.cookie = 'midb_hint=; max-age=0; path=/';
	Element.prototype.scrollIntoView = vi.fn();
});

afterEach(() => {
	cleanup();
	session.clear();
	history.replaceState(null, '', '/');
	vi.useRealTimers();
});

describe('CommentsSection links to a comment', () => {
	it('scrolls to, focuses and highlights a comment on the loaded page, with no thread request', async () => {
		history.replaceState(null, '', '/movie/603#comment-first');
		const fetcher = api();
		const { container } = mount(fetcher);
		const article = await waitFor(() => {
			const el = document.getElementById('comment-first');
			expect(el?.className).toMatch(/comment--linked/);
			return el as HTMLElement;
		});
		expect(container.querySelector('details')?.id).toBe('comments');
		expect(Element.prototype.scrollIntoView).toHaveBeenCalled();
		expect(document.activeElement).toBe(article);
		expect(threadCalls(fetcher)).toEqual([]);
	});

	it('opens a section the reader closed when the hash changes to a comment', async () => {
		const { container } = mount(api());
		await screen.findByText('Text of first');
		const details = container.querySelector('details') as HTMLDetailsElement;
		details.open = false;
		history.replaceState(null, '', '/movie/603#comment-first');
		window.dispatchEvent(new HashChangeEvent('hashchange'));
		expect(details.open).toBe(true);
	});

	it('fetches the thread of a comment on a later page and pins it above the list', async () => {
		history.replaceState(null, '', '/movie/603#comment-second');
		const fetcher = api({ second: { root: view('second'), review: null } });
		mount(fetcher);
		const pinned = await screen.findByRole('region', { name: 'Linked comment' });
		expect(pinned.querySelector('#comment-second')).toBeTruthy();
		expect(threadCalls(fetcher)).toEqual(['/api/comments/second']);
		const first = document.getElementById('comment-first') as HTMLElement;
		expect(pinned.compareDocumentPosition(first) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
		await waitFor(() => expect(document.activeElement?.id).toBe('comment-second'));
	});

	it('never draws the pinned thread twice once the page that carries it loads', async () => {
		history.replaceState(null, '', '/movie/603#comment-second');
		const fetcher = api({ second: { root: view('second'), review: null } });
		mount(fetcher);
		await screen.findByRole('region', { name: 'Linked comment' });
		await fireEvent.click(screen.getByRole('button', { name: 'Show more comments' }));
		await waitFor(() =>
			expect(fetcher.mock.calls.some(([url]) => url.includes('cursor=two'))).toBe(true)
		);
		await waitFor(() =>
			expect(screen.queryByRole('button', { name: 'Show more comments' })).toBeNull()
		);
		expect(articles('second')).toHaveLength(1);
		expect(articles('first')).toHaveLength(1);
	});

	it('does not draw the pinned thread twice when the list reloads under another sort', async () => {
		history.replaceState(null, '', '/movie/603#comment-first');
		const fetcher = api({ first: { root: view('first'), review: null } });
		mount(fetcher);
		await screen.findByText('Text of first');
		await fireEvent.click(screen.getByRole('button', { name: 'Newest' }));
		await waitFor(() => expect(articles('first')).toHaveLength(1));
	});

	it('shows the status of a pending comment its reader may see', async () => {
		history.replaceState(null, '', '/movie/603#comment-second');
		const fetcher = api({
			second: { root: view('second'), review: { status: 'pending', reason: null } }
		});
		mount(fetcher);
		const pinned = await screen.findByRole('region', { name: 'Linked comment' });
		expect(pinned.textContent).toMatch(/Awaiting review/);
		expect(pinned.textContent).toMatch(/Only the author and moderators see the comment/);
		expect(pinned.querySelector('button')).toBeNull();
	});

	it('gives staff no controls on another account’s hidden comment', async () => {
		session.set({ ...ANNA, id: 'mod', username: 'mod', displayName: 'mod', role: 'moderator' });
		history.replaceState(null, '', '/movie/603#comment-second');
		const fetcher = api({
			second: { root: view('second'), review: { status: 'hidden', reason: 'off topic' } }
		});
		mount(fetcher);
		const pinned = await screen.findByRole('region', { name: 'Linked comment' });
		expect(pinned.textContent).toMatch(/A moderator hid this comment/);
		for (const name of ['Edit', 'Delete', 'Report', 'Reply', 'Upvote']) {
			expect(within(pinned).queryByRole('button', { name })).toBeNull();
		}
	});

	it('offers an author no edit on their hidden comment, and no delete on a deleted one', async () => {
		session.set(ANNA);
		history.replaceState(null, '', '/movie/603#comment-second');
		const fetcher = api({
			second: { root: view('second'), review: { status: 'deleted', reason: null } }
		});
		mount(fetcher);
		const pinned = await screen.findByRole('region', { name: 'Linked comment' });
		expect(within(pinned).queryByRole('button', { name: 'Edit' })).toBeNull();
		expect(within(pinned).queryByRole('button', { name: 'Delete' })).toBeNull();
	});

	it('says so when the comment is not available, and still shows the list', async () => {
		history.replaceState(null, '', '/movie/603#comment-missing');
		mount(api());
		expect(await screen.findByText('This comment is not available.')).toBeTruthy();
		expect(screen.getByText('Text of first')).toBeTruthy();
		expect(screen.queryByRole('region', { name: 'Linked comment' })).toBeNull();
	});

	it('follows a hash change to another comment and highlights it, then clears the highlight', async () => {
		const fetcher = api({ second: { root: view('second'), review: null } });
		mount(fetcher);
		await screen.findByText('Text of first');
		vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
		history.replaceState(null, '', '/movie/603#comment-second');
		window.dispatchEvent(new HashChangeEvent('hashchange'));
		await vi.waitFor(() =>
			expect(document.getElementById('comment-second')?.className).toMatch(/comment--linked/)
		);
		vi.advanceTimersByTime(2600);
		await vi.waitFor(() =>
			expect(document.getElementById('comment-second')?.className).not.toMatch(/comment--linked/)
		);
	});

	it('ignores a hash that does not name a comment', async () => {
		history.replaceState(null, '', '/movie/603#cast');
		const fetcher = api();
		mount(fetcher);
		await screen.findByText('Text of first');
		expect(threadCalls(fetcher)).toEqual([]);
		expect(document.querySelector('.comment--linked')).toBeNull();
	});

	it('links each comment date to the comment', async () => {
		mount(api());
		await screen.findByText('Text of first');
		const link = document.querySelector('#comment-first a.permalink');
		expect(link?.getAttribute('href')).toBe('/movie/603#comment-first');
	});
});
