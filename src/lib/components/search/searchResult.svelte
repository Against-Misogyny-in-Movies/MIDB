<script lang="ts">
	import { resolve } from '$app/paths';
	import ResultPoster from './resultPoster.svelte';
	import { optionId } from './movieSearch.svelte.js';
	import type { SearchResult } from './types';

	interface Props {
		movie: SearchResult;
		active: boolean;
		onhover: () => void;
		onselect: () => void;
	}

	let { movie, active, onhover, onselect }: Props = $props();

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
	class="row"
	class:active
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
		<ResultPoster posterPath={movie.posterPath} alt={movie.title} />
		<span class="info">
			<span class="title">{movie.title}</span>
			{#if movie.releaseYear || movie.mediaType}
				<span class="meta">
					{#if movie.mediaType === 'tv'}
						<i class="ri-tv-2-line" aria-hidden="true"></i>
						<span class="type-badge">TV</span>
					{:else}
						<i class="ri-film-line" aria-hidden="true"></i>
						<span class="type-badge">Film</span>
					{/if}
					{#if movie.releaseYear}
						<span class="year">{movie.releaseYear}</span>
					{/if}
				</span>
			{/if}
		</span>
		<i class="chevron ri-arrow-right-s-line" aria-hidden="true"></i>
	</a>
</li>

<style lang="postcss">
	@reference "../../../app.css";

	.row a {
		@apply flex flex-row items-center gap-sm p-xs no-underline text-ink cursor-pointer rounded-sm;
	}

	.row.active a {
		@apply bg-accent-bg text-accent-ink;
	}

	.info {
		@apply flex flex-col min-w-0 flex-1;
	}

	.title {
		@apply font-medium text-sm leading-snug truncate;
	}

	.meta {
		@apply flex flex-row items-center gap-xs text-xs text-ink-muted;
	}

	.row.active .meta {
		@apply text-accent-ink opacity-80;
	}

	.meta i {
		@apply text-[0.8rem] leading-none opacity-70;
	}

	.type-badge {
		@apply leading-none;
	}

	.year {
		@apply leading-none;
	}

	.chevron {
		@apply flex-shrink-0 text-lg text-ink-muted opacity-0;
	}

	/* Only the active row fades its chevron in. Leaving a row hides it instantly
	   (no exit transition), so sweeping the highlight down the list doesn't leave a
	   trail of fading chevrons behind it. No transform — the slide read as a smear. */
	.row.active .chevron {
		@apply opacity-100 text-accent-ink;
		transition: opacity 120ms ease-out;
	}

	@media (prefers-reduced-motion: reduce) {
		.row.active .chevron {
			transition: none;
		}
	}
</style>
