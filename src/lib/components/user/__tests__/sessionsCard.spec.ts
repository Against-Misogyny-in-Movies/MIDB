import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SESSION_COOKIE_CACHE_SECONDS } from '#lib/media/utils/sessionCache.ts';
import type { AccountSession } from '#lib/media/types/sessions.ts';

const { default: SessionsCard } = await import('../sessionsCard.svelte');
const { toasts } = await import('#lib/media/utils/toasts.svelte.js');

const here: AccountSession = {
	id: 's-here',
	label: 'Firefox on Linux',
	mobile: false,
	startedAt: '2026-11-14T10:00:00Z',
	current: true
};
const phone: AccountSession = {
	id: 's-phone',
	label: 'Safari on iOS',
	mobile: true,
	startedAt: '2026-11-03T10:00:00Z',
	current: false
};
const laptop: AccountSession = {
	id: 's-laptop',
	label: 'Chrome on Windows',
	mobile: false,
	startedAt: '2026-11-02T10:00:00Z',
	current: false
};

const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200 });
const fetchMock = vi.fn<typeof fetch>();

const mount = (initialCount: number) => render(SessionsCard, { initialCount });

beforeEach(() => {
	vi.stubGlobal('fetch', fetchMock);
	fetchMock.mockResolvedValue(json([here]));
});

afterEach(() => {
	cleanup();
	for (const toast of toasts.items) toasts.dismiss(toast.id);
	vi.unstubAllGlobals();
	vi.resetAllMocks();
});

describe('while the list loads', () => {
	it('shows one busy skeleton row per session the page counted, and the sign-out-everywhere button', () => {
		fetchMock.mockReturnValue(new Promise(() => {}));
		const { container } = mount(3);
		expect(screen.getByRole('heading', { name: 'Sessions' })).toBeTruthy();
		expect(container.querySelector('section')?.getAttribute('aria-busy')).toBe('true');
		expect(screen.getByRole('status').textContent).toContain('Loading sessions');
		expect(container.querySelectorAll('.skeleton-row')).toHaveLength(3);
		expect(screen.getByRole('button', { name: 'Sign out everywhere else' })).toHaveProperty(
			'disabled',
			true
		);
	});

	it('has no sign-out-everywhere button when the page counted one session', () => {
		fetchMock.mockReturnValue(new Promise(() => {}));
		mount(1);
		expect(screen.queryByRole('button', { name: 'Sign out everywhere else' })).toBeNull();
	});
});

describe('the loaded list', () => {
	it('shows the browser, the day and This device on the current session, with no sign-out on it', async () => {
		fetchMock.mockResolvedValue(json([here, phone]));
		const { container } = mount(2);
		await screen.findByText('Safari on iOS');
		const rows = container.querySelectorAll('li');
		expect(rows).toHaveLength(2);
		expect(rows[0].textContent).toContain('Firefox on Linux');
		expect(rows[0].textContent).toContain('This device');
		expect(rows[0].textContent).toContain('Since 14/11/2026');
		expect(rows[0].querySelector('button')).toBeNull();
		expect(rows[1].textContent).not.toContain('This device');
		expect(rows[1].textContent).toContain('Since 03/11/2026');
		expect(screen.getByRole('button', { name: 'Sign out Safari on iOS' })).toBeTruthy();
		expect(container.querySelector('section')?.getAttribute('aria-busy')).toBe('false');
	});

	it('says how long a signed-out session can keep working, from the cookie cache time', async () => {
		fetchMock.mockResolvedValue(json([here, phone]));
		mount(2);
		await screen.findByText('Safari on iOS');
		expect(screen.getByText(/can keep working for up to/).textContent).toContain(
			`${SESSION_COOKIE_CACHE_SECONDS / 60} minutes`
		);
	});

	it('shows no sign-out-everywhere button and no cache line for one session', async () => {
		mount(1);
		await screen.findByText('Firefox on Linux');
		expect(screen.queryByRole('button', { name: 'Sign out everywhere else' })).toBeNull();
		expect(screen.queryByText(/can keep working/)).toBeNull();
	});

	it('adds the time to sessions with the same label', async () => {
		const twin = { ...laptop, id: 's-twin', label: 'Safari on iOS' };
		fetchMock.mockResolvedValue(json([here, phone, twin]));
		const { container } = mount(3);
		await screen.findAllByText('Safari on iOS');
		expect(container.querySelectorAll('li')[1].textContent).toMatch(
			/Since 03\/11\/2026, \d\d:\d\d/
		);
	});
});

describe('load failed', () => {
	it('shows an error notice in the card, with the heading and no list', async () => {
		fetchMock.mockResolvedValue(new Response(null, { status: 500 }));
		const { container } = mount(2);
		await screen.findByText(/sessions could not be loaded/);
		expect(screen.getByRole('heading', { name: 'Sessions' })).toBeTruthy();
		expect(container.querySelector('li')).toBeNull();
		expect(container.querySelector('section')?.getAttribute('aria-busy')).toBe('false');
	});
});

describe('signing out one session', () => {
	it('asks first, then ends it, reloads the list and toasts', async () => {
		fetchMock.mockResolvedValueOnce(json([here, phone, laptop]));
		mount(3);
		await screen.findByText('Safari on iOS');

		await fireEvent.click(screen.getByRole('button', { name: 'Sign out Safari on iOS' }));
		expect(screen.getByText(/Sign out Safari on iOS\? It needs to sign in again/)).toBeTruthy();
		expect(fetchMock).toHaveBeenCalledTimes(1);

		fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }));
		fetchMock.mockResolvedValueOnce(json([here, laptop]));
		await fireEvent.click(screen.getByRole('button', { name: 'Sign out' }));
		await waitFor(() => expect(screen.queryByText('Safari on iOS')).toBeNull());
		expect(fetchMock).toHaveBeenCalledWith('/api/me/sessions/s-phone', { method: 'DELETE' });
		expect(toasts.items.some((t) => t.text === 'Signed out Safari on iOS.')).toBe(true);
	});

	it('Cancel closes the plate and ends nothing', async () => {
		fetchMock.mockResolvedValueOnce(json([here, phone]));
		mount(2);
		await screen.findByText('Safari on iOS');
		await fireEvent.click(screen.getByRole('button', { name: 'Sign out Safari on iOS' }));
		await fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
		expect(screen.queryByText(/It needs to sign in again/)).toBeNull();
		expect(fetchMock).toHaveBeenCalledTimes(1);
	});

	it('a failed sign-out is a toast and keeps the list', async () => {
		fetchMock.mockResolvedValueOnce(json([here, phone]));
		mount(2);
		await screen.findByText('Safari on iOS');
		await fireEvent.click(screen.getByRole('button', { name: 'Sign out Safari on iOS' }));
		fetchMock.mockResolvedValueOnce(new Response(null, { status: 500 }));
		await fireEvent.click(screen.getByRole('button', { name: 'Sign out' }));
		await waitFor(() =>
			expect(toasts.items.some((t) => /could not be signed out/.test(t.text))).toBe(true)
		);
		expect(screen.getByText('Safari on iOS')).toBeTruthy();
	});
});

describe('signing out everywhere else', () => {
	it('asks first, then ends the others; the button is gone with one session left', async () => {
		fetchMock.mockResolvedValueOnce(json([here, phone, laptop]));
		mount(3);
		await screen.findByText('Safari on iOS');

		await fireEvent.click(screen.getByRole('button', { name: 'Sign out everywhere else' }));
		expect(screen.getByText(/Sign out every other session\?/)).toBeTruthy();

		fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }));
		fetchMock.mockResolvedValueOnce(json([here]));
		const confirm = screen.getAllByRole('button', { name: 'Sign out everywhere else' })[1];
		await fireEvent.click(confirm);
		await waitFor(() => expect(screen.queryByText('Safari on iOS')).toBeNull());
		expect(fetchMock).toHaveBeenCalledWith('/api/me/sessions', { method: 'DELETE' });
		expect(toasts.items.some((t) => t.text === 'Signed out everywhere else.')).toBe(true);
		expect(screen.queryByRole('button', { name: 'Sign out everywhere else' })).toBeNull();
	});

	it('shows the running action as busy while the request is pending', async () => {
		fetchMock.mockResolvedValueOnce(json([here, phone]));
		mount(2);
		await screen.findByText('Safari on iOS');
		await fireEvent.click(screen.getByRole('button', { name: 'Sign out everywhere else' }));
		fetchMock.mockReturnValueOnce(new Promise(() => {}));
		const confirm = screen.getAllByRole('button', { name: 'Sign out everywhere else' })[1];
		await fireEvent.click(confirm);
		await waitFor(() => expect(confirm.getAttribute('aria-busy')).toBe('true'));
		expect(screen.getByRole('button', { name: 'Sign out Safari on iOS' })).toHaveProperty(
			'disabled',
			true
		);
	});
});
