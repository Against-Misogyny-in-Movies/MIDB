<script lang="ts">
	import Portrait from './Portrait.svelte';

	interface Props {
		size?: number;
	}
	let { size = 40 }: Props = $props();
</script>

<!-- Frida Kahlo: a braided crown with flowers, joined brows, an embroidered Tehuana collar. -->
<Portrait {size}>
	{#snippet back()}
		<ellipse cx="20" cy="14.6" rx="7" ry="7.6" fill="var(--avatar-hair)" /><ellipse
			cx="20"
			cy="9"
			rx="8.4"
			ry="2.7"
			fill="var(--avatar-hair)"
		/>
	{/snippet}
	{#snippet dress()}
		<path d="M12.5 30Q20 34.5 27.5 30" stroke="var(--avatar-light)" stroke-width="1.8" />
	{/snippet}
	{#snippet front()}
		<path
			d="M14 16C13.8 10.6 16.5 9.3 20 9.5C23.5 9.3 26.2 10.6 26 16C25 12.7 23 11.7 20 11.9C17 11.7 15 12.7 14 16Z"
			fill="var(--avatar-hair)"
		/><circle cx="13.6" cy="8.2" r="2.5" fill="var(--avatar-mark)" /><circle
			cx="26.4"
			cy="8.2"
			r="2.5"
			fill="var(--avatar-mark)"
		/><circle cx="20" cy="6.5" r="2.9" fill="var(--avatar-light)" /><circle
			cx="13.6"
			cy="8.2"
			r="0.8"
			fill="var(--avatar-hair)"
		/><circle cx="20" cy="6.5" r="0.9" fill="var(--avatar-hair)" /><circle
			cx="26.4"
			cy="8.2"
			r="0.8"
			fill="var(--avatar-hair)"
		/>
	{/snippet}
	{#snippet detail()}
		<path
			d="M16.2 15.4Q18.2 14.3 20 15.2Q21.8 14.3 23.8 15.4"
			stroke="var(--avatar-hair)"
			stroke-width="1"
			stroke-linecap="round"
		/>
	{/snippet}
</Portrait>
