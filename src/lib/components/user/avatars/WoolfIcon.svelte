<script lang="ts">
	import Portrait from './Portrait.svelte';

	interface Props {
		size?: number;
	}
	let { size = 40 }: Props = $props();
</script>

<!-- Virginia Woolf: hair parted in the centre and drawn over the ears into a low bun, a cardigan. -->
<Portrait {size}>
	{#snippet back()}
		<ellipse cx="20" cy="16" rx="7" ry="7.6" fill="var(--avatar-hair)" /><circle
			cx="25.6"
			cy="23.2"
			r="2.6"
			fill="var(--avatar-hair)"
		/>
	{/snippet}
	{#snippet dress()}
		<path
			d="M17 28.8L20 35L23 28.8"
			stroke="var(--avatar-line)"
			stroke-width="0.6"
			stroke-opacity="0.45"
		/>
	{/snippet}
	{#snippet front()}
		<path
			d="M14 20C13.2 12 16 9.6 20 9.6S26.8 12 26 20C25.4 15 24 12.6 20.3 11.8L20 12.6L19.7 11.8C16 12.6 14.6 15 14 20Z"
			fill="var(--avatar-hair)"
		/>
	{/snippet}
</Portrait>
