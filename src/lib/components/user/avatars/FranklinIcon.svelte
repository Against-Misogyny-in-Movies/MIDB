<script lang="ts">
	import Portrait from './Portrait.svelte';

	interface Props {
		size?: number;
	}
	let { size = 40 }: Props = $props();
</script>

<!-- Rosalind Franklin: a deep side part with the hair swept to one side, a white blouse collar, the X of Photo 51. -->
<Portrait {size}>
	{#snippet back()}
		<ellipse cx="19.4" cy="15.2" rx="7.4" ry="7.6" fill="var(--avatar-hair)" /><ellipse
			cx="25.6"
			cy="13.4"
			rx="3.2"
			ry="4.2"
			fill="var(--avatar-hair)"
		/>
	{/snippet}
	{#snippet dress()}
		<path d="M16.4 28.7L20 32.4L23.6 28.7Z" fill="var(--avatar-light)" />
	{/snippet}
	{#snippet front()}
		<path
			d="M13.6 16.6C13 10.6 16.4 8.4 20.4 8.6C24.8 8.8 27.8 11.4 27 17.4C26 13.6 24 12.2 21.4 12.2C18.6 12.2 16 13.6 13.6 16.6Z"
			fill="var(--avatar-hair)"
		/>
	{/snippet}
	{#snippet detail()}
		<path
			d="M27.2 28L32.8 34M32.8 28L27.2 34"
			stroke="var(--avatar-mark)"
			stroke-width="1.2"
			stroke-dasharray="1 0.8"
		/>
	{/snippet}
</Portrait>
