import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { writable } from 'svelte/store';
import type { SearchResult } from '$lib/components/search/types';

const goto = vi.fn();
const navigating = writable<object | null>(null);
vi.mock('$app/navigation', () => ({ goto }));
vi.mock('$app/stores', () => ({ navigating }));
vi.mock('$app/paths', () => ({
	resolve: (route: string, params: Record<string, string>) =>
		route.replace(/\[(\w+)\]/, (_, key) => params[key])
}));

const { MovieSearchState, optionId } = await import('$lib/components/search/movieSearch.svelte.js');

const MATRIX: SearchResult = {
	id: 603,
	title: 'The Matrix',
	posterPath: null,
	releaseYear: '1999',
	mediaType: 'movie'
};
const GOT: SearchResult = {
	id: 1399,
	title: 'Game of Thrones',
	posterPath: null,
	releaseYear: '2011',
	mediaType: 'tv'
};

const fetchMock = vi.fn();

function respondWith(results: SearchResult[], status = 200) {
	fetchMock.mockImplementation(
		async () =>
			new Response(JSON.stringify(status === 200 ? { results } : { message: 'x' }), { status })
	);
}

// Components call connect() in an $effect; do the same and tear down after each test.
let teardowns: (() => void)[] = [];
function connected() {
	const s = new MovieSearchState();
	teardowns.push(s.connect());
	return s;
}

function key(name: string) {
	return new KeyboardEvent('keydown', { key: name, cancelable: true });
}

beforeEach(() => {
	vi.useFakeTimers();
	fetchMock.mockReset();
	goto.mockReset();
	vi.stubGlobal('fetch', fetchMock);
	respondWith([MATRIX, GOT]);
});

afterEach(() => {
	teardowns.forEach((t) => t());
	teardowns = [];
	vi.useRealTimers();
	vi.unstubAllGlobals();
});

describe('MovieSearchState', () => {
	it('opens with a spinner at once, then fetches /api/search after 500 ms', async () => {
		const s = connected();
		s.search('mat rix');
		expect(s).toMatchObject({ query: 'mat rix', loading: true, open: true, results: [] });
		expect(s.isOpen).toBe(true);

		await vi.advanceTimersByTimeAsync(499);
		expect(fetchMock).not.toHaveBeenCalled();
		await vi.advanceTimersByTimeAsync(1);

		expect(fetchMock).toHaveBeenCalledOnce();
		expect(fetchMock.mock.calls[0][0]).toBe('/api/search?q=mat%20rix');
		expect(s).toMatchObject({ loading: false, activeIndex: -1, results: [MATRIX, GOT] });
	});

	it('debounces typing into one request for the last value', async () => {
		const s = connected();
		for (const q of ['m', 'ma', 'mat']) {
			s.search(q);
			await vi.advanceTimersByTimeAsync(100);
		}
		await vi.advanceTimersByTimeAsync(500);
		expect(fetchMock).toHaveBeenCalledOnce();
		expect(fetchMock.mock.calls[0][0]).toBe('/api/search?q=mat');
	});

	it('clears stale rows while the next query is pending', async () => {
		const s = connected();
		s.search('matrix');
		await vi.advanceTimersByTimeAsync(500);
		expect(s.results).toHaveLength(2);

		s.search('matrixx');
		expect(s.results).toEqual([]);
		expect(s.loading).toBe(true);
	});

	it('closes on an empty query without fetching', async () => {
		const s = connected();
		s.search('   ');
		expect(s).toMatchObject({ open: false, loading: false, results: [] });
		expect(s.isOpen).toBe(false);
		await vi.advanceTimersByTimeAsync(1000);
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it('shows no results (not a stuck spinner) on an error response such as a 429', async () => {
		respondWith([], 429);
		const s = connected();
		s.search('matrix');
		await vi.advanceTimersByTimeAsync(500);
		expect(s).toMatchObject({ loading: false, results: [] });
	});

	it('aborts the previous request when the query changes', async () => {
		fetchMock.mockImplementation(() => new Promise(() => {}));
		const s = connected();
		s.search('matrix');
		await vi.advanceTimersByTimeAsync(500);
		const firstSignal = fetchMock.mock.calls[0][1].signal as AbortSignal;
		expect(firstSignal.aborted).toBe(false);
		s.search('matrix r');
		expect(firstSignal.aborted).toBe(true);
	});

	it('close() keeps query and results so reopen() re-shows them without a refetch', async () => {
		const s = connected();
		s.search('matrix');
		await vi.advanceTimersByTimeAsync(500);
		s.close();
		expect(s.isOpen).toBe(false);
		s.reopen();
		expect(s.isOpen).toBe(true);
		expect(s.results).toHaveLength(2);
		expect(fetchMock).toHaveBeenCalledOnce();
	});

	it('moves the highlight with wrap-around and exposes the active option id', async () => {
		const s = connected();
		s.search('matrix');
		await vi.advanceTimersByTimeAsync(500);

		s.handleKeydown(key('ArrowDown'));
		expect(s.activeIndex).toBe(0);
		expect(s.activeId).toBe(optionId(603, 'movie'));
		s.handleKeydown(key('ArrowDown'));
		s.handleKeydown(key('ArrowDown'));
		expect(s.activeIndex).toBe(0);
		s.handleKeydown(key('ArrowUp'));
		expect(s.activeIndex).toBe(1);
		expect(s.activeId).toBe('search-option-tv-1399');
	});

	it('Enter navigates to the highlighted result by media type; Escape closes', async () => {
		const s = connected();
		s.search('matrix');
		await vi.advanceTimersByTimeAsync(500);

		s.highlight(1);
		s.handleKeydown(key('Enter'));
		expect(goto).toHaveBeenCalledWith('/tv/1399');
		expect(s.navigatingTo).toEqual(GOT);

		s.select(MATRIX);
		expect(goto).toHaveBeenLastCalledWith('/movie/603');

		s.handleKeydown(key('Escape'));
		expect(s.open).toBe(false);
	});

	it('resets the box once a result-driven navigation completes', async () => {
		const s = new MovieSearchState();
		const disconnect = s.connect();
		s.search('matrix');
		await vi.advanceTimersByTimeAsync(500);

		s.select(MATRIX);
		navigating.set({});
		navigating.set(null);
		expect(s).toMatchObject({ query: '', results: [], open: false, navigatingTo: null });
		disconnect();
	});

	it('the connect() teardown drops a pending query', async () => {
		const s = new MovieSearchState();
		const disconnect = s.connect();
		s.search('matrix');
		disconnect();
		await vi.advanceTimersByTimeAsync(1000);
		expect(fetchMock).not.toHaveBeenCalled();
	});
});
