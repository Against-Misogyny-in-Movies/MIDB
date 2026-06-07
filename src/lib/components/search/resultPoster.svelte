<script lang="ts" module>
	import { PUBLIC_TMDB_IMAGE_URL } from '$env/static/public';

	// The thumbnail renders at 40x60 CSS px. TMDB's w92 (≈92px wide) covers that at
	// 2x DPR without pulling the multi-megabyte `original` the shared Image component
	// would fetch. Keeping a dedicated tiny <img> here is what keeps a 20-row result
	// list from costing several MB per keystroke.
	const base = (PUBLIC_TMDB_IMAGE_URL ?? '').replace(/\/$/, '');

	function thumb(posterPath: string) {
		return `${base}/w92${posterPath.startsWith('/') ? '' : '/'}${posterPath}`;
	}
</script>

<script lang="ts">
	interface Props {
		posterPath: string | null;
		alt: string;
	}

	let { posterPath, alt }: Props = $props();
</script>

<span class="poster">
	{#if posterPath}
		<img src={thumb(posterPath)} {alt} width="40" height="60" loading="lazy" decoding="async" />
	{:else}
		<span class="placeholder" aria-hidden="true">
			<i class="ri-film-line"></i>
		</span>
	{/if}
</span>

<style lang="postcss">
	@reference "../../../app.css";

	.poster {
		@apply block flex-shrink-0 overflow-hidden rounded-sm bg-surface;
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
