<script lang="ts">
	import Portrait from './Portrait.svelte';

	interface Props {
		size?: number;
	}
	let { size = 40 }: Props = $props();
</script>

<!-- Marie Curie: hair swept up into a top bun, a black high-necked dress, a glow of radium. -->
<Portrait {size}>
	{#snippet back()}
		<ellipse cx="20" cy="12.8" rx="7.8" ry="6.6" fill="var(--avatar-hair)" /><circle
			cx="20"
			cy="6.4"
			r="2.9"
			fill="var(--avatar-hair)"
		/>
	{/snippet}
	{#snippet dress()}
		<path d="M5 42C5 32 11 28.5 20 28.5S35 32 35 42Z" fill="var(--avatar-hair)" /><rect
			x="17"
			y="24.4"
			width="6"
			height="5"
			rx="1.2"
			fill="var(--avatar-hair)"
		/><circle cx="30" cy="31" r="2.2" fill="var(--avatar-mark)" /><path
			d="M30 26.6V28M30 34V35.4M25.6 31H27M33 31H34.4M26.9 27.9L27.9 28.9M32.1 33.1L33.1 34.1M33.1 27.9L32.1 28.9M27.9 33.1L26.9 34.1"
			stroke="var(--avatar-mark)"
			stroke-width="0.8"
			stroke-linecap="round"
		/>
	{/snippet}
	{#snippet front()}
		<path
			d="M14.1 16C13.4 11 16.4 9.2 20 9.3C23.6 9.2 26.6 11 25.9 16C25.3 13.2 23.4 12.3 20 12.5C16.6 12.3 14.7 13.2 14.1 16Z"
			fill="var(--avatar-hair)"
		/>
	{/snippet}
</Portrait>
