<script lang="ts">
	import Portrait from './Portrait.svelte';

	interface Props {
		size?: number;
	}
	let { size = 40 }: Props = $props();
</script>

<!-- Agnès Varda: a two-tone bowl cut, dark at the rim and light on the crown. -->
<Portrait {size}>
	{#snippet back()}
		<path d="M12.8 19C12.8 9.6 15.8 7 20 7S27.2 9.6 27.2 19Z" fill="var(--avatar-hair)" />
	{/snippet}
	{#snippet front()}
		<path
			d="M13.8 14.6V12.6C13.8 10 16.4 8.6 20 8.6S26.2 10 26.2 12.6V14.6Z"
			fill="var(--avatar-hair)"
		/><path
			d="M14.6 11.2C15 8.4 17.2 7 20 7S25 8.4 25.4 11.2C23.6 10.4 22 10.2 20 10.2S16.4 10.4 14.6 11.2Z"
			fill="var(--avatar-mark)"
		/>
	{/snippet}
</Portrait>
