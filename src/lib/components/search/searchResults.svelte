<script lang="ts">
	import SearchResult from './searchResult.svelte';
	import { optionId } from './movieSearch.svelte.js';
	import type { SearchResult as SearchResultType } from './types';

	interface Props {
		id: string;
		results: SearchResultType[];
		activeIndex: number;
		loading: boolean;
		navigatingTo: SearchResultType | null;
		onhighlight: (index: number) => void;
		onselect: (movie: SearchResultType) => void;
	}

	let { id, results, activeIndex, loading, navigatingTo, onhighlight, onselect }: Props = $props();

	// Keep the highlighted row visible as the user arrows through a long list.
	$effect(() => {
		const movie = results[activeIndex];
		if (!movie) return;
		document
			.getElementById(optionId(movie.id, movie.mediaType))
			?.scrollIntoView({ block: 'nearest' });
	});
</script>

{#if results.length > 0}
	<ul {id} class="panel" role="listbox" aria-label="Search results">
		{#each results as movie, i (movie.id)}
			<SearchResult
				{movie}
				active={i === activeIndex}
				pending={navigatingTo?.id === movie.id && navigatingTo?.mediaType === movie.mediaType}
				onhover={() => onhighlight(i)}
				onselect={() => onselect(movie)}
			/>
		{/each}
	</ul>
{:else if loading}
	<div class="panel status" role="status" aria-live="polite">
		<i class="ri-loader-4-line spinner" aria-hidden="true"></i>
		<span>Searching…</span>
	</div>
{:else}
	<div class="panel status" role="status" aria-live="polite">No matches</div>
{/if}

<style lang="postcss">
	@reference "../../../app.css";

	.panel {
		@apply absolute z-50 w-full mt-1;
		@apply bg-surface-raised border border-border rounded-md shadow-md;
	}

	ul.panel {
		@apply list-none p-xs m-0 flex flex-col gap-0;
		max-height: 20rem;
		overflow-y: auto;
		scrollbar-color: var(--color-brand) transparent;
	}

	.status {
		@apply flex flex-row items-center gap-xs p-sm text-sm text-ink-muted;
	}

	.spinner {
		@apply text-base;
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
