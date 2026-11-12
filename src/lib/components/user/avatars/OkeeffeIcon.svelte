<script lang="ts">
	import Portrait from './Portrait.svelte';

	interface Props {
		size?: number;
	}
	let { size = 40 }: Props = $props();
</script>

<!-- Georgia O'Keeffe: a flat-brimmed black hat, slicked hair, a black dress. -->
<Portrait {size} dressFill="var(--avatar-hair)">
	{#snippet back()}
		<ellipse cx="20" cy="16" rx="6.4" ry="7" fill="var(--avatar-hair)" />
	{/snippet}
	{#snippet front()}
		<ellipse cx="20" cy="10.8" rx="12" ry="2.4" fill="var(--avatar-hair)" /><path
			d="M14.6 10.8C14.6 6.4 16.8 5 20 5S25.4 6.4 25.4 10.8Z"
			fill="var(--avatar-hair)"
		/><path d="M14.7 9.6H25.3" stroke="var(--avatar-mark)" stroke-width="0.9" />
	{/snippet}
</Portrait>
