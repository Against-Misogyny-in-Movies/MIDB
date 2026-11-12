<script lang="ts">
	import { tmdbImageUrl } from '#lib/media/utils/tmdbImage.ts';

	// The thumbnail renders at 40x60 CSS px. TMDB's w92 (about 92px wide) covers that at 2x DPR,
	// so a 20-row result list costs a few kilobytes per keystroke, not the full poster size.
	interface Props {
		posterPath: string | null;
		alt: string;
	}

	let { posterPath, alt }: Props = $props();
</script>

<span class="poster">
	{#if posterPath}
		<img
			src={tmdbImageUrl('w92', posterPath)}
			{alt}
			width="40"
			height="60"
			loading="lazy"
			decoding="async"
		/>
	{:else}
		<span class="placeholder" aria-hidden="true">
			<i class="ri-film-line"></i>
		</span>
	{/if}
</span>

<style lang="postcss">
	@reference "../../../app.css";

	.poster {
		@apply block flex-shrink-0 overflow-hidden rounded-sm;
		background-color: var(--surface-sunken);
		width: 2.5rem;
		height: 3.75rem;
	}

	.poster img {
		@apply w-full h-full object-cover;
	}

	.placeholder {
		@apply flex items-center justify-center w-full h-full text-ink-muted;
	}
</style>
