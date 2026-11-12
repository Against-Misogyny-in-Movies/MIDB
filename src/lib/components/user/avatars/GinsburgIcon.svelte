<script lang="ts">
	import Portrait from './Portrait.svelte';

	interface Props {
		size?: number;
	}
	let { size = 40 }: Props = $props();
</script>

<!-- Ruth Bader Ginsburg: hair pulled back, large glasses, a lace jabot on a black robe. -->
<Portrait {size}>
	{#snippet back()}
		<ellipse cx="20" cy="15.6" rx="6.6" ry="7" fill="var(--avatar-hair)" />
	{/snippet}
	{#snippet dress()}
		<path d="M5 42C5 32 11 28.5 20 28.5S35 32 35 42Z" fill="var(--avatar-hair)" /><path
			d="M15.6 29L20 35L24.4 29Q20 31 15.6 29Z"
			fill="var(--avatar-light)"
		/>
	{/snippet}
	{#snippet front()}
		<path
			d="M14 15C13.8 10.6 16.4 9.2 20 9.2S26.2 10.6 26 15C25 12.2 23 11.4 20 11.4S15 12.2 14 15Z"
			fill="var(--avatar-hair)"
		/><g stroke="var(--avatar-line)" stroke-width="0.9"
			><rect x="15.2" y="16" width="4.2" height="3.4" rx="1.2" /><rect
				x="20.6"
				y="16"
				width="4.2"
				height="3.4"
				rx="1.2"
			/><path d="M19.4 17.2H20.6" /></g
		>
	{/snippet}
	{#snippet detail()}
		<circle cx="17" cy="30.4" r="0.35" fill="var(--avatar-line)" /><circle
			cx="18.4"
			cy="31.8"
			r="0.35"
			fill="var(--avatar-line)"
		/><circle cx="20" cy="33.4" r="0.35" fill="var(--avatar-line)" /><circle
			cx="21.6"
			cy="31.8"
			r="0.35"
			fill="var(--avatar-line)"
		/><circle cx="23" cy="30.4" r="0.35" fill="var(--avatar-line)" />
	{/snippet}
</Portrait>
