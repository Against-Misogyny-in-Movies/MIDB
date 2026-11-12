<script lang="ts">
	import Portrait from './Portrait.svelte';

	interface Props {
		size?: number;
	}
	let { size = 40 }: Props = $props();
</script>

<!-- Katherine Johnson: short curls, cat-eye glasses, a string of pearls. -->
<Portrait {size}>
	{#snippet back()}
		<circle cx="15" cy="12" r="3.4" fill="var(--avatar-hair)" /><circle
			cx="20"
			cy="10"
			r="3.8"
			fill="var(--avatar-hair)"
		/><circle cx="25" cy="12" r="3.4" fill="var(--avatar-hair)" /><circle
			cx="14.2"
			cy="16.6"
			r="2.6"
			fill="var(--avatar-hair)"
		/><circle cx="25.8" cy="16.6" r="2.6" fill="var(--avatar-hair)" />
	{/snippet}
	{#snippet dress()}
		<circle cx="16.2" cy="29.4" r="0.6" fill="var(--avatar-light)" /><circle
			cx="17.4"
			cy="30"
			r="0.6"
			fill="var(--avatar-light)"
		/><circle cx="18.7" cy="30.4" r="0.6" fill="var(--avatar-light)" /><circle
			cx="20"
			cy="30.5"
			r="0.6"
			fill="var(--avatar-light)"
		/><circle cx="21.3" cy="30.4" r="0.6" fill="var(--avatar-light)" /><circle
			cx="22.6"
			cy="30"
			r="0.6"
			fill="var(--avatar-light)"
		/><circle cx="23.8" cy="29.4" r="0.6" fill="var(--avatar-light)" />
	{/snippet}
	{#snippet front()}
		<circle cx="16.4" cy="11.4" r="2.2" fill="var(--avatar-hair)" /><circle
			cx="20"
			cy="10.6"
			r="2.4"
			fill="var(--avatar-hair)"
		/><circle cx="23.6" cy="11.4" r="2.2" fill="var(--avatar-hair)" /><g
			stroke="var(--avatar-line)"
			stroke-width="0.8"
			stroke-linejoin="round"
			><path d="M15.2 16.2L19.4 16.6L19.2 18.6Q17.6 19.6 16 18.6Z" /><path
				d="M24.8 16.2L20.6 16.6L20.8 18.6Q22.4 19.6 24 18.6Z"
			/><path d="M19.4 17Q20 16.6 20.6 17" /></g
		>
	{/snippet}
</Portrait>
