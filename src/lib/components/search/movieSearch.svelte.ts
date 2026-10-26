import { goto } from '$app/navigation';
import { resolve } from '$app/paths';
import { DebouncedQuery } from '$lib/media/utils/debouncedQuery.svelte.js';
import type { SearchResult } from './types';
import { navigating } from '$app/stores';

/**
 * Calls the `/api/search` endpoint and returns parsed search results. `DebouncedQuery`
 * never calls it for a blank query.
 *
 * @param query - The user's search string.
 * @param signal - Aborts the request once a newer query supersedes it.
 * @returns Array of `SearchResult` items (empty on an error response, e.g. a 429).
 */
async function fetchResults(query: string, signal: AbortSignal): Promise<SearchResult[]> {
	const res = await fetch('/api/search?q=' + encodeURIComponent(query), { signal });
	if (!res.ok) return [];
	const data = await res.json();
	return data.results as SearchResult[];
}

/**
 * Owns the live-search lifecycle for the movie search box: the debounced, cancellable
 * `/api/search` query plus the keyboard-navigation/selection state. Built as a Svelte 5
 * rune class so a component can `bind` to its reactive fields directly.
 */
export class MovieSearchState {
	query = $state('');
	results = $state<SearchResult[]>([]);
	activeIndex = $state(-1);
	loading = $state(false);
	open = $state(false);
	navigatingTo = $state<SearchResult | null>(null);

	#query = new DebouncedQuery(
		fetchResults,
		(results) => {
			this.results = results;
			this.activeIndex = -1;
			this.loading = false;
		},
		{ empty: [], delayMs: 500 }
	);

	/** Whether the dropdown panel should be shown. */
	get isOpen() {
		return this.open && this.query.trim().length > 0;
	}

	/** The id of the currently highlighted option, for `aria-activedescendant`. */
	get activeId() {
		const item = this.results[this.activeIndex];
		return item ? optionId(item.id, item.mediaType) : undefined;
	}

	/** Subscribe to SvelteKit navigation. Returns a teardown fn for `$effect` that also drops any pending query. */
	connect() {
		// Clear pending navigation indicator once SvelteKit finishes (or aborts) navigation.
		// If we initiated the navigation (a result was selected), also reset the box so the
		// query/results don't linger on the destination page (e.g. the navbar search).
		const navUnsub = navigating.subscribe((nav) => {
			if (!nav) {
				if (this.navigatingTo) this.reset();
				this.navigatingTo = null;
			}
		});
		return () => {
			this.#query.cancel();
			navUnsub();
		};
	}

	search(query: string) {
		this.query = query;
		if (query.trim().length > 0) {
			// A fetch is coming (after the debounce). Clear the previous query's rows so
			// stale results don't linger ("ghost") under the new query, and show the
			// spinner until the fresh results arrive.
			this.results = [];
			this.activeIndex = -1;
			this.loading = true;
			this.open = true;
		} else {
			this.close();
		}
		this.#query.push(query);
	}

	/** Re-open the panel (e.g. on input focus) if there's a query to show results for. */
	reopen() {
		if (this.query.trim().length > 0) {
			this.open = true;
		}
	}

	close() {
		this.open = false;
		this.activeIndex = -1;
		this.loading = false;
		this.navigatingTo = null;
	}

	/** Fully clear the box — query, results and panel state — e.g. after navigating to a result. */
	reset() {
		this.query = '';
		this.#query.push('');
		this.close();
	}

	highlight(index: number) {
		this.activeIndex = index;
	}

	/** Handle arrow/enter/escape while focus stays in the input. */
	handleKeydown(event: KeyboardEvent) {
		const count = this.results.length;
		if (count === 0) return;

		switch (event.key) {
			case 'ArrowDown':
				event.preventDefault();
				this.activeIndex = (this.activeIndex + 1) % count;
				break;
			case 'ArrowUp':
				event.preventDefault();
				this.activeIndex = (this.activeIndex - 1 + count) % count;
				break;
			case 'Enter':
				if (this.activeIndex >= 0) {
					event.preventDefault();
					this.select(this.results[this.activeIndex]);
				}
				break;
			case 'Escape':
				this.close();
				break;
		}
	}

	/** The search button and Enter with no highlighted row: open the highlighted or first result. */
	submit() {
		const item = this.results[this.activeIndex] ?? this.results[0];
		if (item) this.select(item);
	}

	select(item: SearchResult) {
		this.navigatingTo = item;
		if (item.mediaType === 'tv') {
			goto(resolve('/tv/[seriesId]', { seriesId: String(item.id) }));
		} else {
			goto(resolve('/movie/[movieId]', { movieId: String(item.id) }));
		}
	}
}

/**
 * Generates a stable DOM id for a search result row.
 * Used by both the listbox `role="option"` elements and the input's `aria-activedescendant`.
 *
 * @param id - The TMDB item id.
 * @param mediaType - `"movie"` or `"tv"`.
 * @returns A unique string id like `"search-option-movie-12345"`.
 */
export function optionId(id: number, mediaType: 'movie' | 'tv') {
	return `search-option-${mediaType}-${id}`;
}
