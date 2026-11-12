<script lang="ts">
	import Portrait from './Portrait.svelte';

	interface Props {
		size?: number;
	}
	let { size = 40 }: Props = $props();
</script>

<!-- Maya Angelou: close-cropped hair, a wide smile, a beaded necklace. -->
<Portrait {size} smile>
	{#snippet back()}
		<ellipse cx="20" cy="13.8" rx="8.8" ry="9" fill="var(--avatar-hair)" />
	{/snippet}
	{#snippet dress()}
		<circle cx="15.4" cy="29.6" r="1.15" fill="var(--avatar-light)" /><circle
			cx="17.6"
			cy="30.6"
			r="1.15"
			fill="var(--avatar-light)"
		/><circle cx="20" cy="31" r="1.15" fill="var(--avatar-light)" /><circle
			cx="22.4"
			cy="30.6"
			r="1.15"
			fill="var(--avatar-light)"
		/><circle cx="24.6" cy="29.6" r="1.15" fill="var(--avatar-light)" />
	{/snippet}
	{#snippet front()}
		<path
			d="M13.8 15.6C13.6 10.4 16.4 8.4 20 8.4S26.4 10.4 26.2 15.6C25.2 12.6 23 11.4 20 11.4S14.8 12.6 13.8 15.6Z"
			fill="var(--avatar-hair)"
		/>
	{/snippet}
</Portrait>
