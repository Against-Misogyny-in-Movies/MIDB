<script lang="ts">
	import Portrait from './Portrait.svelte';

	interface Props {
		size?: number;
	}
	let { size = 40 }: Props = $props();
</script>

<!-- Rosalind Franklin: a short side-swept wave, the X of Photo 51 beside her. -->
<Portrait {size}>
	{#snippet back()}
		<ellipse cx="20" cy="15.5" rx="7" ry="7.4" fill="var(--avatar-hair)" />
	{/snippet}
	{#snippet dress()}
		<path
			d="M27.2 28L32.8 34M32.8 28L27.2 34"
			stroke="var(--avatar-mark)"
			stroke-width="1.2"
			stroke-dasharray="1 0.8"
		/>
	{/snippet}
	{#snippet front()}
		<path
			d="M13.6 17C13 10.5 16.4 8.8 20.4 9C24.4 9.2 27.2 11.4 26.4 17C25.8 14 24.4 12.2 21.6 12.4C18.6 12.6 17.6 11.6 16.2 13C15 14.2 14.2 15.4 13.6 17Z"
			fill="var(--avatar-hair)"
		/>
	{/snippet}
</Portrait>
