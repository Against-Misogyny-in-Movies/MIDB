<script lang="ts">
	import Portrait from './Portrait.svelte';

	interface Props {
		size?: number;
	}
	let { size = 40 }: Props = $props();
</script>

<!-- Angela Davis: a round afro, a turtleneck, hoop earrings. -->
<Portrait {size}>
	{#snippet back()}
		<circle cx="20" cy="14.6" r="11.8" fill="var(--avatar-hair)" />
	{/snippet}
	{#snippet dress()}
		<rect x="16.6" y="24.4" width="6.8" height="5" rx="2" fill="var(--avatar-dress)" />
	{/snippet}
	{#snippet front()}
		<path
			d="M14.3 15C14.6 11.2 17 10 20 10S25.4 11.2 25.7 15C24.6 12.6 22.6 11.9 20 11.9S15.4 12.6 14.3 15Z"
			fill="var(--avatar-hair)"
		/><g stroke="var(--avatar-mark)" stroke-width="0.8"
			><circle cx="14" cy="20.8" r="1.3" /><circle cx="26" cy="20.8" r="1.3" /></g
		>
	{/snippet}
</Portrait>
