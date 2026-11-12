<script lang="ts">
	import Portrait from './Portrait.svelte';

	interface Props {
		size?: number;
	}
	let { size = 40 }: Props = $props();
</script>

<!-- Ada Lovelace: smooth hair parted in the centre, ringlets at the ears, an off-shoulder gown. -->
<Portrait {size}>
	{#snippet back()}
		<ellipse cx="20" cy="15" rx="7.2" ry="7.6" fill="var(--avatar-hair)" /><ellipse
			cx="13.2"
			cy="21"
			rx="1.5"
			ry="3"
			fill="var(--avatar-hair)"
		/><ellipse cx="26.8" cy="21" rx="1.5" ry="3" fill="var(--avatar-hair)" />
	{/snippet}
	{#snippet dress()}
		<path
			d="M8 33C10 30 14 28.6 20 28.6S30 30 32 33C28 32 24 33 20 33S12 32 8 33Z"
			fill="var(--avatar-face)"
		/>
	{/snippet}
	{#snippet front()}
		<path
			d="M14 18C13.6 11 16.4 9.6 20 9.6S26.4 11 26 18C25 13.6 23.4 12.4 20.4 11.6L20 12.4L19.6 11.6C16.6 12.4 15 13.6 14 18Z"
			fill="var(--avatar-hair)"
		/>
	{/snippet}
</Portrait>
