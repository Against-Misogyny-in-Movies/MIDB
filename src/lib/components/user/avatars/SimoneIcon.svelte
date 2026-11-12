<script lang="ts">
	import Portrait from './Portrait.svelte';

	interface Props {
		size?: number;
	}
	let { size = 40 }: Props = $props();
</script>

<!-- Nina Simone: a tall head wrap, long drop earrings. -->
<Portrait {size}>
	{#snippet back()}
		<ellipse cx="20" cy="15" rx="6.6" ry="7" fill="var(--avatar-hair)" />
	{/snippet}
	{#snippet front()}
		<path
			d="M13.6 14C13 8 15 3.6 20 3.4C25 3.6 27 8 26.4 14C25 11.6 23 11.2 20 11.2S15 11.6 13.6 14Z"
			fill="var(--avatar-mark)"
		/><path
			d="M15.6 9Q20 6.6 24.4 9M15 12Q20 8.8 25 12"
			stroke="var(--avatar-line)"
			stroke-width="0.5"
			stroke-opacity="0.35"
		/><ellipse cx="14" cy="22.4" rx="1.1" ry="1.8" fill="var(--avatar-light)" /><ellipse
			cx="26"
			cy="22.4"
			rx="1.1"
			ry="1.8"
			fill="var(--avatar-light)"
		/>
	{/snippet}
</Portrait>
