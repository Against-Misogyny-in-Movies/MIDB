<script lang="ts">
	import Portrait from './Portrait.svelte';

	interface Props {
		size?: number;
	}
	let { size = 40 }: Props = $props();
</script>

<!-- Malala Yousafzai: a dupatta draped over the hair and down over the shoulders. -->
<Portrait {size}>
	{#snippet back()}
		<path d="M11.6 22C11 11 14.6 6.8 20 6.8S29 11 28.4 22L31 42H9Z" fill="var(--avatar-mark)" />
	{/snippet}
	{#snippet dress()}
		<path d="M9 42C9.6 34 10.6 28 12.6 24L16 29.4L13.6 42Z" fill="var(--avatar-mark)" /><path
			d="M31 42C30.4 34 29.4 28 27.4 24L24 29.4L26.4 42Z"
			fill="var(--avatar-mark)"
		/>
	{/snippet}
	{#snippet front()}
		<path
			d="M14.2 16C14.4 11.6 17 10.4 20 10.4S25.6 11.6 25.8 16C24.6 12.8 22.4 12.2 20 12.2S15.4 12.8 14.2 16Z"
			fill="var(--avatar-hair)"
		/><path
			d="M13.6 16C13.4 10 16.2 8.4 20 8.4S26.6 10 26.4 16C25.6 11.6 23.4 10.2 20 10.2S14.4 11.6 13.6 16Z"
			fill="var(--avatar-mark)"
		/>
	{/snippet}
</Portrait>
