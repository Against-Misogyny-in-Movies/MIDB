<script lang="ts">
	import type { Snippet } from 'svelte';
	import { PORTRAIT_DETAIL_MIN } from '#lib/media/utils/avatars.ts';

	interface Props {
		size?: number;
		/** A wide smile instead of the closed mouth. */
		smile?: boolean;
		/** Behind the head: the hair's outline, a bun, a drape. */
		back?: Snippet;
		/** Over the shoulders: a collar, a robe, a print, a necklace. */
		dress?: Snippet;
		/** Over the face: a fringe, headwear, earrings, glasses. Drawn at every size. */
		front?: Snippet;
		/** Fine marks drawn only from `PORTRAIT_DETAIL_MIN` px up. */
		detail?: Snippet;
	}

	let { size = 40, smile = false, back, dress, front, detail }: Props = $props();

	const clipId = $props.id();
	const detailed = $derived(size >= PORTRAIT_DETAIL_MIN);
</script>

<!-- The shared figure on a 40-unit grid: plate, neck, shoulders and face; each icon adds the rest. -->
<svg
	width={size}
	height={size}
	viewBox="0 0 40 40"
	fill="none"
	xmlns="http://www.w3.org/2000/svg"
	aria-hidden="true"
>
	<defs>
		<clipPath id={clipId}><circle cx="20" cy="20" r="20" /></clipPath>
	</defs>
	<circle cx="20" cy="20" r="20" fill="var(--avatar-plate)" />
	<g clip-path="url(#{clipId})">
		{@render back?.()}
		<rect x="17.6" y="21" width="4.8" height="8.5" fill="var(--avatar-face)" />
		<path d="M5 42C5 32 11 28.5 20 28.5S35 32 35 42Z" fill="var(--avatar-dress)" />
		{@render dress?.()}
		<ellipse cx="20" cy="17" rx="5.8" ry="7" fill="var(--avatar-face)" />
		{#if detailed}
			<g data-portrait-detail fill="var(--avatar-line)">
				<circle cx="17.7" cy="17.8" r="0.8" />
				<circle cx="22.3" cy="17.8" r="0.8" />
				{#if smile}
					<path d="M17.8 20.6Q20 22.9 22.2 20.6Z" />
				{:else}
					<path
						d="M18.6 21.1Q20 22 21.4 21.1"
						fill="none"
						stroke="var(--avatar-line)"
						stroke-width="0.8"
						stroke-linecap="round"
					/>
				{/if}
			</g>
		{/if}
		{@render front?.()}
		{#if detailed}{@render detail?.()}{/if}
	</g>
</svg>
