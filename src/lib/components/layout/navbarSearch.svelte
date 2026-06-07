<script lang="ts">
	import { tick } from 'svelte';
	import { nanoid } from 'nanoid';
	import { navigating } from '$app/stores';
	import SearchResults from '$lib/components/search/searchResults.svelte';
	import { MovieSearchState } from '$lib/components/search/movieSearch.svelte.js';

	// Own MovieSearchState instance — the navbar search is fully independent of the
	// landing hero search. Reuses the search lifecycle/keyboard model and the
	// SearchResults dropdown, but renders a compact, collapse-by-default input
	// instead of the full searchInput box (which carries a heavy submit button).
	const search = new MovieSearchState();
	const listboxId = nanoid();

	let root = $state<HTMLElement | null>(null);
	let input = $state<HTMLInputElement | null>(null);
	// Non-intrusive by default: show only the search icon until the user opens it.
	let expanded = $state(false);

	$effect(() => search.connect());

	// Selecting a result navigates away and MovieSearchState clears the query on
	// completion; fold the field back to the icon once that navigation lands.
	$effect(() => {
		if ($navigating && search.navigatingTo) expanded = false;
	});

	async function open() {
		expanded = true;
		await tick();
		input?.focus();
	}

	function collapse() {
		search.close();
		// Only fold back to the icon when there's nothing typed, so a populated
		// query stays visible (and its results re-show on re-focus).
		if (!search.query.trim()) expanded = false;
	}

	function onKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape') {
			// First Escape closes the panel; collapse the field too if empty.
			collapse();
		}
		search.handleKeydown(event);
	}

	function onWindowPointerDown(event: PointerEvent) {
		if (root && !root.contains(event.target as Node)) {
			collapse();
		}
	}
</script>

<svelte:window onpointerdown={onWindowPointerDown} />

<div class="root" class:is-expanded={expanded} bind:this={root}>
	{#if expanded}
		<div class="field">
			<i class="ri-search-line lead" aria-hidden="true"></i>
			<input
				bind:this={input}
				type="text"
				name="query"
				placeholder="Search movies & TV…"
				value={search.query}
				oninput={(e) => search.search(e.currentTarget.value)}
				onkeydown={onKeydown}
				onfocus={() => search.reopen()}
				role="combobox"
				aria-autocomplete="list"
				aria-expanded={search.results.length > 0}
				aria-controls={listboxId}
				aria-activedescendant={search.activeId}
				autocomplete="off"
			/>
			{#if search.loading}
				<i class="ri-loader-4-line spinner" aria-hidden="true"></i>
			{/if}
		</div>

		{#if search.isOpen}
			<SearchResults
				id={listboxId}
				results={search.results}
				activeIndex={search.activeIndex}
				loading={search.loading}
				navigatingTo={search.navigatingTo}
				onhighlight={(i) => search.highlight(i)}
				onselect={(movie) => search.select(movie)}
			/>
		{/if}
	{:else}
		<button class="trigger" onclick={open} aria-label="Search" title="Search">
			<i class="ri-search-line" aria-hidden="true"></i>
		</button>
	{/if}
</div>

<style lang="postcss">
	@reference "../../../app.css";

	.root {
		@apply relative shrink-0;
	}

	.root.is-expanded {
		@apply flex-1 min-w-0;
		max-width: 22rem;
	}

	/* Collapsed trigger — matches the themeToggle density/vocabulary. */
	.trigger {
		@apply bg-surface-raised text-ink border border-border rounded-md p-xs;
		@apply hover:text-brand transition-colors cursor-pointer;
	}

	.trigger:focus-visible {
		outline: 2px solid var(--accent);
		outline-offset: 2px;
	}

	/* Expanded field — same surface as themeToggle/searchInput, no submit button. */
	.field {
		@apply flex items-center gap-xs;
		@apply bg-surface-raised border border-border rounded-md;
		@apply px-sm;
		transition: border-color 0.15s ease;
	}

	.field:focus-within {
		@apply border-brand;
	}

	.lead {
		@apply text-ink-muted text-sm shrink-0;
	}

	input {
		@apply flex-1 min-w-0 bg-transparent text-sm py-xs;
	}

	input::placeholder {
		@apply text-ink-muted;
	}

	input:focus {
		@apply outline-none;
	}

	.spinner {
		@apply text-ink-muted text-sm shrink-0;
		animation: spin 0.7s linear infinite;
	}

	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.spinner {
			animation: none;
		}
	}
</style>
