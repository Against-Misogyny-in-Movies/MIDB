<script lang="ts">
	import type { Snippet } from 'svelte';
	import Image from '$lib/components/movies/media/image.svelte';
	import type { MediaDetail } from '$lib/media/types/media';

	interface Props {
		media: MediaDetail;
		/** Two-axis at-a-glance verdict rendered between the title meta and the chips. */
		verdict?: Snippet;
		/** Rendered in the info column below the verdict (chip row + facts). */
		children?: Snippet;
	}

	let { media, children, verdict }: Props = $props();

	const year = $derived(media.releaseDate ? media.releaseDate.slice(0, 4) : '');
</script>

<header class="detail-header">
	<div class="poster-wrap">
		{#if media.posterPath}
			<Image src={media.posterPath} alt={media.title} imgSizes="(max-width: 768px) 40vw, 300px" />
		{:else}
			<span class="poster-placeholder" aria-hidden="true">
				<i class="ri-film-line"></i>
			</span>
		{/if}
	</div>

	<div class="info">
		<h1 class="display">{media.title}</h1>
		<p class="meta label">
			{#if year}{year}{/if}
			{#if media.releaseDate}
				<span class="release-date">{year ? ' · ' : ''}{media.releaseDate}</span>
			{/if}
		</p>
		{@render verdict?.()}
		{#if children}
			{@render children()}
		{/if}
	</div>
</header>

<style lang="postcss">
	@reference "../../../../app.css";

	.detail-header {
		@apply flex flex-col gap-lg;
	}

	@media (min-width: 768px) {
		.detail-header {
			@apply flex-row items-start;
		}
	}

	.poster-wrap {
		@apply flex-shrink-0 overflow-hidden rounded-md bg-surface-raised;
		width: 200px;
		aspect-ratio: 2 / 3;
	}

	@media (min-width: 768px) {
		.poster-wrap {
			width: 300px;
		}
	}

	.poster-wrap :global(img) {
		@apply w-full h-full object-cover;
	}

	.poster-placeholder {
		@apply flex items-center justify-center w-full h-full text-ink-muted text-4xl;
	}

	.info {
		@apply flex flex-col gap-md min-w-0 flex-1;
	}

	h1 {
		@apply text-4xl font-bold;
	}

	.meta {
		@apply mt-xs;
	}

	.release-date {
		@apply text-ink-muted;
	}
</style>
