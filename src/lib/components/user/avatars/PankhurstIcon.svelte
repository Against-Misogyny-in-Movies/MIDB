<script lang="ts">
	import Portrait from './Portrait.svelte';

	interface Props {
		size?: number;
	}
	let { size = 40 }: Props = $props();
</script>

<!-- Emmeline Pankhurst: an upswept pompadour, a high collar, a suffrage sash. -->
<Portrait {size}>
	{#snippet back()}
		<ellipse cx="20" cy="14.4" rx="7.4" ry="7.8" fill="var(--avatar-hair)" /><ellipse
			cx="20"
			cy="10"
			rx="7.8"
			ry="5"
			fill="var(--avatar-hair)"
		/>
	{/snippet}
	{#snippet dress()}
		<rect x="17" y="23.6" width="6" height="5.4" rx="1.4" fill="var(--avatar-light)" /><path
			d="M9.5 31.5L13 30L31 41L27 42Z"
			fill="var(--avatar-mark)"
		/>
	{/snippet}
	{#snippet front()}
		<path
			d="M13.8 15C13 9 16.5 6.8 20 6.8S27 9 26.2 15C25.4 11.6 23 10.8 20 11S14.6 11.6 13.8 15Z"
			fill="var(--avatar-hair)"
		/>
	{/snippet}
	{#snippet detail()}
		<path d="M17.2 24.8H22.8" stroke="var(--avatar-line)" stroke-width="0.5" opacity="0.5" />
	{/snippet}
</Portrait>
