<script lang="ts">
	import type { Snippet } from 'svelte';
	import Image from '$lib/components/movies/media/image.svelte';
	import type { MediaDetail } from '$lib/media/types/media';

	interface Props {
		media: MediaDetail;
		/** The two-axis verdict, rendered under the overview. */
		verdict?: Snippet;
		/** Rendered last in the info column (the source index). */
		children?: Snippet;
	}

	let { media, children, verdict }: Props = $props();

	const meta = $derived(
		[media.releaseDate.slice(0, 4), media.genres.map((g) => g.name).join(', ')]
			.filter(Boolean)
			.join(' · ')
	);
</script>

<header class="detail-header">
	<div class="poster">
		{#if media.posterPath}
			<Image src={media.posterPath} alt="" imgSizes="(max-width: 767px) 88px, 224px" />
		{:else}
			<span class="poster-placeholder" aria-hidden="true">
				<i class="ri-film-line"></i>
			</span>
		{/if}
	</div>

	<div class="heading">
		<h1 class="display">{media.title}</h1>
		{#if meta}
			<p class="meta">{meta}</p>
		{/if}
	</div>

	<div class="body">
		{#if media.overview}
			<p class="overview">{media.overview}</p>
		{/if}
		{@render verdict?.()}
		{@render children?.()}
	</div>
</header>

<style lang="postcss">
	@reference "../../../../app.css";

	/* Phones: a small poster beside the title, everything else full width below.
	   Desktop: the poster takes its own column and the info stacks beside it. */
	.detail-header {
		@apply grid items-start;
		grid-template-columns: 5.5rem minmax(0, 1fr);
		grid-template-areas:
			'poster heading'
			'body body';
		gap: var(--spacing-md);
	}

	@media (min-width: 768px) {
		.detail-header {
			grid-template-columns: 14rem minmax(0, 1fr);
			grid-template-rows: auto 1fr;
			grid-template-areas:
				'poster heading'
				'poster body';
			column-gap: var(--spacing-lg);
			row-gap: var(--spacing-md);
		}
	}

	.poster {
		grid-area: poster;
		@apply overflow-hidden;
		border-radius: 12px;
		aspect-ratio: 2 / 3;
		background-color: var(--surface-sunken);
		box-shadow:
			0 0 0 1px color-mix(in oklab, var(--ink) 8%, transparent),
			var(--shadow-md);
	}

	.poster :global(img) {
		@apply w-full h-full object-cover;
	}

	.poster-placeholder {
		@apply flex items-center justify-center w-full h-full text-ink-muted text-3xl;
	}

	.heading {
		grid-area: heading;
		@apply flex flex-col gap-xs self-center;
	}

	@media (min-width: 768px) {
		.heading {
			@apply self-start;
		}
	}

	h1 {
		font-size: clamp(1.75rem, 5vw, 3rem);
		line-height: 1.05;
		letter-spacing: -0.015em;
	}

	.meta {
		@apply text-ink-muted;
	}

	.body {
		grid-area: body;
		@apply flex flex-col gap-lg min-w-0;
	}

	.overview {
		@apply text-ink-muted;
		max-width: 65ch;
	}
</style>
