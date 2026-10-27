<script lang="ts">
	import { resolve } from '$app/paths';
	import ResultPoster from './resultPoster.svelte';
	import { optionId } from './movieSearch.svelte.js';
	import type { SearchResult } from './types';

	interface Props {
		movie: SearchResult;
		active: boolean;
		pending: boolean;
		onhover: () => void;
		onselect: () => void;
	}

	let { movie, active, pending, onhover, onselect }: Props = $props();

	let href = $derived(
		movie.mediaType === 'tv'
			? resolve('/tv/[seriesId]', { seriesId: String(movie.id) })
			: resolve('/movie/[movieId]', { movieId: String(movie.id) })
	);
</script>

<li
	id={optionId(movie.id, movie.mediaType)}
	role="option"
	aria-selected={active}
	aria-busy={pending}
	class="row"
	class:active
	class:pending
	onmouseenter={onhover}
>
	<a
		{href}
		tabindex="-1"
		onclick={(e) => {
			e.preventDefault();
			onselect();
		}}
	>
		<ResultPoster posterPath={movie.posterPath} alt="" />
		<span class="info">
			<span class="title">{movie.title}</span>
			<span class="meta">
				{movie.mediaType === 'tv' ? 'Series' : 'Film'}{movie.releaseYear
					? ` · ${movie.releaseYear}`
					: ''}
			</span>
		</span>
		{#if pending}
			<i class="spinner ri-loader-4-line" aria-hidden="true"></i>
		{/if}
	</a>
</li>

<style lang="postcss">
	@reference "../../../app.css";

	.row a {
		@apply flex items-center gap-md px-md py-xs no-underline text-ink cursor-pointer;
	}

	.row.active a {
		background-color: var(--surface-sunken);
	}

	.info {
		@apply flex flex-col min-w-0 flex-1;
	}

	.title {
		@apply font-medium leading-snug truncate;
	}

	.meta {
		@apply text-sm text-ink-muted;
	}

	.row.pending a {
		@apply pointer-events-none;
	}

	.spinner {
		@apply shrink-0 text-ink-muted;
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
