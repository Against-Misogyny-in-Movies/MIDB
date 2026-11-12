<script lang="ts">
	import Portrait from './Portrait.svelte';

	interface Props {
		size?: number;
	}
	let { size = 40 }: Props = $props();
</script>

<!-- Audre Lorde: a head wrap tied at the side, large round earrings. -->
<Portrait {size}>
	{#snippet front()}
		<path
			d="M13 15C12.4 9 15.6 5.8 20 5.8S27.6 9 27 15C25.8 12.2 23.6 11.4 20 11.4S14.2 12.2 13 15Z"
			fill="var(--avatar-dress)"
		/><circle cx="25" cy="6.8" r="2.6" fill="var(--avatar-dress)" /><path
			d="M15 10.6Q20 8 25 10.6"
			stroke="var(--avatar-line)"
			stroke-width="0.5"
			stroke-opacity="0.35"
		/><circle cx="13.9" cy="21.4" r="1.8" fill="var(--avatar-light)" /><circle
			cx="26.1"
			cy="21.4"
			r="1.8"
			fill="var(--avatar-light)"
		/>
	{/snippet}
</Portrait>
