<script lang="ts">
	import Portrait from './Portrait.svelte';

	interface Props {
		size?: number;
	}
	let { size = 40 }: Props = $props();
</script>

<!-- Grace Hopper: a naval officer's cap over short hair, a dark uniform with a white collar. -->
<Portrait {size} dressFill="var(--avatar-hair)">
	{#snippet back()}
		<ellipse cx="20" cy="17" rx="6.8" ry="6.6" fill="var(--avatar-hair)" />
	{/snippet}
	{#snippet dress()}
		<path d="M16.6 28.7L20 32.6L23.4 28.7" stroke="var(--avatar-light)" stroke-width="1" />
	{/snippet}
	{#snippet front()}
		<path
			d="M12.4 11.6C12.4 7.4 16 5.6 20 5.6S27.6 7.4 27.6 11.6Z"
			fill="var(--avatar-dress)"
		/><rect x="13.4" y="10.4" width="13.2" height="2.2" fill="var(--avatar-hair)" /><path
			d="M13.4 12.4Q20 15.4 26.6 12.4L26 13.4Q20 16 14 13.4Z"
			fill="var(--avatar-hair)"
		/><circle cx="20" cy="8.8" r="1.2" fill="var(--avatar-light)" />
	{/snippet}
</Portrait>
