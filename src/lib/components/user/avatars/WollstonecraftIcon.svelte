<script lang="ts">
	import Portrait from './Portrait.svelte';

	interface Props {
		size?: number;
	}
	let { size = 40 }: Props = $props();
</script>

<!-- Mary Wollstonecraft: loose curls to the shoulders, a white fichu over a dark gown. -->
<Portrait {size} dressFill="var(--avatar-hair)">
	{#snippet back()}
		<circle cx="20" cy="10" r="6.5" fill="var(--avatar-hair)" /><circle
			cx="15.5"
			cy="10.5"
			r="4"
			fill="var(--avatar-hair)"
		/><circle cx="24.5" cy="10.5" r="4" fill="var(--avatar-hair)" /><circle
			cx="13.6"
			cy="14.6"
			r="4"
			fill="var(--avatar-hair)"
		/><circle cx="26.4" cy="14.6" r="4" fill="var(--avatar-hair)" /><circle
			cx="14"
			cy="20"
			r="3.6"
			fill="var(--avatar-hair)"
		/><circle cx="26" cy="20" r="3.6" fill="var(--avatar-hair)" />
	{/snippet}
	{#snippet dress()}
		<path d="M12 30.4Q20 27 28 30.4L20 37.4Z" fill="var(--avatar-light)" />
	{/snippet}
	{#snippet front()}
		<circle cx="16" cy="11" r="2.6" fill="var(--avatar-hair)" /><circle
			cx="20"
			cy="10.2"
			r="2.8"
			fill="var(--avatar-hair)"
		/><circle cx="24" cy="11" r="2.6" fill="var(--avatar-hair)" />
	{/snippet}
</Portrait>
