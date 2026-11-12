<script lang="ts" module>
	import { tmdbImageUrl, type TmdbImageSize } from '#lib/media/utils/tmdbImage.ts';

	// Srcset widths, capped at w780: a 3x screen of the 224px poster needs 672px.
	const sizes: readonly TmdbImageSize[] = ['w200', 'w300', 'w400', 'w500', 'w780'];
</script>

<script lang="ts">
	interface Props {
		src: string;
		alt: string;
		imgSizes?: string;
		/** The image is the page's main picture: the browser fetches it first. */
		priority?: boolean;
	}

	let { src, alt, imgSizes, priority = false }: Props = $props();

	const srcset = $derived(
		sizes.map((size) => `${tmdbImageUrl(size, src)} ${size.slice(1)}w`).join(', ')
	);
</script>

<!-- width and height give the 2:3 ratio of a TMDB poster; the parent's box sizes the image. -->
<img
	src={tmdbImageUrl('w500', src)}
	{srcset}
	sizes={imgSizes}
	{alt}
	width="500"
	height="750"
	fetchpriority={priority ? 'high' : undefined}
	decoding="async"
/>

<style lang="postcss">
	@reference "../../../../app.css";
	img {
		@apply h-full;
	}
</style>
