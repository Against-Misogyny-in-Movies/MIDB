import { goto } from '$app/navigation';
import { resolve } from '$app/paths';
import { createDebouncedSearchStore } from '$lib/stores/debounced';
import type { SearchResult } from './types';

/**
 * Calls the `/api/search` endpoint and returns parsed search results.
 * Returns an empty array for blank queries without making a network request.
 *
 * @param query - The user's search string.
 * @returns Array of `SearchResult` items (may be empty).
 */
async function fetchResults(query: string): Promise<SearchResult[]> {
	if (!query.trim()) return [];
	const res = await fetch('/api/search?q=' + encodeURIComponent(query));
	const data = await res.json();
	return data.results as SearchResult[];
}

/**
 * Owns the live-search lifecycle for the movie search box: the debounced TMDB
 * query store plus the keyboard-navigation/selection state. Built as a Svelte 5
 * rune class so a component can `bind` to its reactive fields directly.
 */
export class MovieSearchState {
	query = $state('');
	results = $state<SearchResult[]>([]);
	activeIndex = $state(-1);
	loading = $state(false);
	open = $state(false);

	#store = createDebouncedSearchStore(fetchResults, 500);

	/** Whether the dropdown panel should be shown. */
	get isOpen() {
		return this.open && this.query.trim().length > 0;
	}

	/** The id of the currently highlighted option, for `aria-activedescendant`. */
	get activeId() {
		const item = this.results[this.activeIndex];
		return item ? optionId(item.id, item.mediaType) : undefined;
	}

	/** Subscribe to the debounced result stream. Returns an unsubscribe fn for `$effect`. */
	connect() {
		const sub = this.#store.subscribe((r) => {
			this.results = r as SearchResult[];
			this.activeIndex = -1;
			this.loading = false;
		});
		return () => sub.unsubscribe();
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
		this.#store.search(query);
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

	select(item: SearchResult) {
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
