<script lang="ts">
	import { tick } from 'svelte';
	import { navigating } from '$app/stores';
	import SearchResults from '$lib/components/search/searchResults.svelte';
	import { MovieSearchState } from '$lib/components/search/movieSearch.svelte.js';
	import { SEARCH_QUERY_MAX_LENGTH } from '$lib/media/utils/search';

	// Own MovieSearchState instance — the navbar search is fully independent of the
	// landing hero search. Reuses the search lifecycle/keyboard model and the
	// SearchResults dropdown, but renders a compact, collapse-by-default input
	// instead of the full searchInput box (which carries a heavy submit button).
	const search = new MovieSearchState();
	const listboxId = $props.id();

	let root = $state<HTMLElement | null>(null);
	let input = $state<HTMLInputElement | null>(null);
	// Non-intrusive by default: show only the search icon until the user opens it.
	let expanded = $state(false);

	$effect(() => search.connect());

	// Selecting a result keeps the field open (with its input spinner) for the
	// duration of the navigation, so the user has feedback while the destination
	// page loads. Track that a result-driven navigation is in flight, then fold the
	// field back to the icon once it lands (MovieSearchState clears `navigatingTo`
	// and the query on completion). Gating on this flag avoids collapsing a freshly
	// opened empty field — only a completed navigation triggers the fold.
	let navigationInFlight = $state(false);
	$effect(() => {
		if (search.navigatingTo) {
			navigationInFlight = true;
		} else if (navigationInFlight && !$navigating) {
			navigationInFlight = false;
			expanded = false;
		}
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
				placeholder="Search films and series"
				aria-label="Search films and series"
				maxlength={SEARCH_QUERY_MAX_LENGTH}
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
			{#if search.loading || search.navigatingTo}
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

	.root.is-expanded :global(.panel) {
		width: min(22rem, calc(100vw - 2rem));
		left: auto;
		right: 0;
	}

	/* Below md the theme toggle and menu sit right of the field, so `.root`'s right edge is
	   mid-bar and a 22rem panel anchored there overhangs the viewport's left edge. Pin it to the
	   viewport padding instead (the bar is `px-md`). The navbar is not sticky, so a fixed `top`
	   just below the 3.5rem bar tracks the field. */
	@media (max-width: 767px) {
		.root.is-expanded :global(.panel) {
			position: fixed;
			top: 3.5rem;
			left: var(--spacing-md);
			right: var(--spacing-md);
			width: auto;
			margin-top: 0;
		}
	}

	.trigger {
		@apply flex text-ink-muted bg-transparent border-0 p-0 leading-none cursor-pointer text-lg;
		transition: color 0.15s ease;
	}

	.trigger:hover {
		@apply text-ink;
	}

	.field {
		@apply flex items-center gap-sm px-sm rounded-md;
		height: 2rem;
		border: 1px solid var(--border-strong);
		background-color: var(--surface-raised);
		transition: border-color 0.15s ease;
	}

	.field:focus-within {
		border-color: var(--brand);
	}

	.lead,
	.spinner {
		@apply text-ink-muted text-sm shrink-0;
	}

	input {
		@apply flex-1 min-w-0 bg-transparent text-sm;
	}

	input::placeholder {
		@apply text-ink-muted;
	}

	input:focus-visible {
		@apply outline-none;
	}

	.spinner {
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
