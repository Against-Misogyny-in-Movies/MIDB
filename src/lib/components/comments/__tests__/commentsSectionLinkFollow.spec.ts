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

const view = (id: string): CommentView => ({
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
	replies: []
});

const thread = (id: string): CommentThread => ({
	kind: 'movie',
	tmdbId: 603,
	root: view(id),
	review: null
});

const json = (body: unknown, status = 200) =>
	new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

const LIST = '/api/titles/movie/603/comments';

/** The list holds `first`; `threads` answers `GET /api/comments/<id>`; an id in `failing` answers 503. */
function api(threads: Record<string, CommentThread>, failing: string[] = [], gate?: Promise<void>) {
	return vi.fn(async (input: string) => {
		const [path] = input.split('?');
		if (path === LIST) return json({ comments: [view('first')], nextCursor: null });
		if (path.endsWith('/viewer')) {
			return json({ votes: {}, scores: {}, comments: [], mutedUntil: null });
		}
		const id = path.split('/').pop() as string;
		if (gate) await gate;
		if (failing.includes(id)) return json({ message: 'down' }, 503);
		return threads[id] ? json(threads[id]) : json({ message: 'Not found' }, 404);
	});
}

/** The pinned block once its thread has loaded: its slot is in the page, busy, while it loads. */
const pinnedBlock = () =>
	waitFor(() => {
		const region = screen.getByRole('region', { name: 'Linked comment' });
		expect(region.getAttribute('aria-busy')).toBe('false');
		return region;
	});

const mount = (fetcher: ReturnType<typeof api>) =>
	render(CommentsSection, { kind: 'movie', tmdbId: '603', fetcher });

function follow(id: string) {
	history.replaceState(null, '', `/movie/603#comment-${id}`);
	window.dispatchEvent(new HashChangeEvent('hashchange'));
}

beforeEach(() => {
	session.clear();
	document.cookie = 'midb_hint=; max-age=0; path=/';
	Element.prototype.scrollIntoView = vi.fn();
});

afterEach(() => {
	cleanup();
	session.clear();
	history.replaceState(null, '', '/');
});

describe('CommentsSection following a second link', () => {
	it('keeps the drawn list, and its open drafts, while the next thread loads in the pin slot', async () => {
		let release!: () => void;
		const gate = new Promise<void>((resolve) => (release = resolve));
		session.set(ANNA);
		const fetcher = api({ far: thread('far') }, [], gate);
		mount(fetcher);
		await screen.findByText('Text of first');
		const article = document.getElementById('comment-first') as HTMLElement;
		const more = await within(article).findByRole('button', { name: /^More actions/ });
		await waitFor(() => expect((more as HTMLButtonElement).disabled).toBe(false));
		await fireEvent.click(more);
		await fireEvent.click(within(article).getByRole('button', { name: 'Edit' }));
		const draft = (await screen.findByLabelText('Edit comment')) as HTMLTextAreaElement;
		await fireEvent.input(draft, { target: { value: 'Half-written edit' } });

		follow('far');
		const slot = await waitFor(() => {
			const el = document.querySelector('[data-linked]') as HTMLElement;
			expect(el.getAttribute('aria-busy')).toBe('true');
			return el;
		});
		expect(slot.querySelector('.skeleton-row')).toBeTruthy();
		expect(document.getElementById('comment-first')).toBe(article);
		expect(screen.getByDisplayValue('Half-written edit')).toBe(draft);
		release();
		const pinned = await pinnedBlock();
		expect(pinned.getAttribute('aria-busy')).toBe('false');
		expect(pinned.querySelector('#comment-far')).toBeTruthy();
		expect(document.getElementById('comment-first')).toBe(article);
	});

	it('scrolls to the pinned block so its label clears the header, and focuses the comment', async () => {
		history.replaceState(null, '', '/movie/603#comment-far');
		const scroll = vi.fn();
		Element.prototype.scrollIntoView = scroll;
		mount(api({ far: thread('far') }));
		await waitFor(() => expect(document.activeElement?.id).toBe('comment-far'));
		expect(scroll.mock.contexts.at(-1)).toBe(document.querySelector('[data-linked]'));
	});

	it('drops the previous pin and says so when the next link fails, then scrolls to the notice', async () => {
		const scroll = vi.fn();
		Element.prototype.scrollIntoView = scroll;
		mount(api({ far: thread('far') }));
		await screen.findByText('Text of first');
		follow('far');
		await pinnedBlock();
		follow('gone');
		const notice = await screen.findByText('This comment is not available.');
		expect(screen.queryByRole('region', { name: 'Linked comment' })).toBeNull();
		expect(screen.queryByRole('button', { name: 'Try again' })).toBeNull();
		const wrapper = notice.closest('[data-link-notice]') as HTMLElement;
		await waitFor(() => expect(document.activeElement).toBe(wrapper));
		expect(scroll.mock.contexts.at(-1)).toBe(wrapper);
	});

	it('offers Try again after a failure that is not a 404, and follows the link on retry', async () => {
		const failing = ['far'];
		const fetcher = api({ far: thread('far') }, failing);
		history.replaceState(null, '', '/movie/603#comment-far');
		mount(fetcher);
		await screen.findByText(/linked comment could not be loaded/);
		failing.length = 0;
		await fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
		const pinned = await pinnedBlock();
		expect(pinned.querySelector('#comment-far')).toBeTruthy();
		expect(screen.queryByText(/linked comment could not be loaded/)).toBeNull();
	});

	it('hides the sort toolbar when only a pinned thread shows', async () => {
		history.replaceState(null, '', '/movie/603#comment-far');
		const fetcher = vi.fn(async (input: string) => {
			if (input.startsWith(LIST)) return json({ comments: [], nextCursor: null });
			return json(thread('far'));
		});
		mount(fetcher);
		await pinnedBlock();
		expect(document.querySelector('.toolbar--hidden')).toBeTruthy();
	});

	it('labels the pinned block by its visible heading', async () => {
		history.replaceState(null, '', '/movie/603#comment-far');
		mount(api({ far: thread('far') }));
		const pinned = await pinnedBlock();
		expect(pinned.hasAttribute('aria-label')).toBe(false);
		const label = document.getElementById(pinned.getAttribute('aria-labelledby') as string);
		expect(label?.textContent).toBe('Linked comment');
	});
});
