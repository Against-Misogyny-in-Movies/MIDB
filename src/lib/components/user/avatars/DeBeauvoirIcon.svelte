<script lang="ts">
	import Portrait from './Portrait.svelte';

	interface Props {
		size?: number;
	}
	let { size = 40 }: Props = $props();
</script>

<!-- Simone de Beauvoir: hair wrapped in a light turban, an open collar. -->
<Portrait {size}>
	{#snippet back()}
		<ellipse cx="20" cy="15" rx="6.6" ry="7" fill="var(--avatar-hair)" />
	{/snippet}
	{#snippet dress()}
		<path d="M16.4 28.7L20 33.5L23.6 28.7Z" fill="var(--avatar-face)" /><path
			d="M16.4 28.7L18.6 33M23.6 28.7L21.4 33"
			stroke="var(--avatar-line)"
			stroke-width="0.5"
			stroke-opacity="0.4"
		/>
	{/snippet}
	{#snippet front()}
		<path
			d="M13.2 15.5C12.6 9 16 6.4 20 6.4S27.4 9 26.8 15.5C25.6 12.6 23.4 11.8 20 11.8S14.4 12.6 13.2 15.5Z"
			fill="var(--avatar-light)"
		/><path
			d="M14.6 10.6Q20 8.2 25.4 10.6M14.4 13.2Q20 9.6 25.6 13.2"
			stroke="var(--avatar-line)"
			stroke-width="0.5"
			stroke-opacity="0.35"
		/>
	{/snippet}
</Portrait>
