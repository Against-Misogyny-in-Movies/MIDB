<script lang="ts">
	import Portrait from './Portrait.svelte';

	interface Props {
		size?: number;
	}
	let { size = 40 }: Props = $props();
</script>

<!-- Sojourner Truth: a white cap, a white shawl crossed over a dark dress, small round glasses. -->
<Portrait {size}>
	{#snippet dress()}
		<path d="M5 42C5 32 11 28.5 20 28.5S35 32 35 42Z" fill="var(--avatar-hair)" /><path
			d="M11 30.6L20 38L29 30.6L33 33L20 42L7 33Z"
			fill="var(--avatar-light)"
		/>
	{/snippet}
	{#snippet front()}
		<path
			d="M13.4 17C13 10.4 16.2 8 20 8S27 10.4 26.6 17C26 14 24.4 12.6 20 12.6S14 14 13.4 17Z"
			fill="var(--avatar-light)"
			stroke="var(--avatar-line)"
			stroke-width="0.4"
			stroke-opacity="0.4"
		/>
	{/snippet}
	{#snippet detail()}
		<g stroke="var(--avatar-line)" stroke-width="0.5" fill="none"
			><circle cx="17.7" cy="17.8" r="1.7" /><circle cx="22.3" cy="17.8" r="1.7" /><path
				d="M19.4 17.6Q20 17.2 20.6 17.6"
			/></g
		>
	{/snippet}
</Portrait>
