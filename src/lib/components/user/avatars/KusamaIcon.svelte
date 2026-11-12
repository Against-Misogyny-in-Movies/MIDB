<script lang="ts">
	import Portrait from './Portrait.svelte';

	interface Props {
		size?: number;
	}
	let { size = 40 }: Props = $props();
</script>

<!-- Yayoi Kusama: a blunt bob with a straight fringe, a polka-dot dress. -->
<Portrait {size}>
	{#snippet back()}
		<path
			d="M12.4 12.4C12.4 7.8 15.8 6.4 20 6.4S27.6 7.8 27.6 12.4V25.4H12.4Z"
			fill="var(--avatar-hair)"
		/>
	{/snippet}
	{#snippet dress()}
		<circle cx="10" cy="35" r="1.5" fill="var(--avatar-light)" /><circle
			cx="15"
			cy="31.6"
			r="1.2"
			fill="var(--avatar-light)"
		/><circle cx="20" cy="36" r="1.6" fill="var(--avatar-light)" /><circle
			cx="25"
			cy="31.6"
			r="1.2"
			fill="var(--avatar-light)"
		/><circle cx="30" cy="35" r="1.5" fill="var(--avatar-light)" /><circle
			cx="13.5"
			cy="39.5"
			r="1.2"
			fill="var(--avatar-light)"
		/><circle cx="26.5" cy="39.5" r="1.2" fill="var(--avatar-light)" />
	{/snippet}
	{#snippet front()}
		<path
			d="M13.6 15V11.8C13.6 9.3 16.4 8.4 20 8.4S26.4 9.3 26.4 11.8V15Z"
			fill="var(--avatar-hair)"
		/>
	{/snippet}
</Portrait>
