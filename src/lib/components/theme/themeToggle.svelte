<script lang="ts">
	import { onMount } from 'svelte';
	import { theme } from '#lib/media/utils/theme.svelte.js';

	const icon = $derived(theme.resolved === 'dark' ? 'ri-moon-line' : 'ri-sun-line');
	const label = $derived(theme.resolved === 'dark' ? 'Theme: dark' : 'Theme: light');

	onMount(() => theme.start());
</script>

<button onclick={() => theme.toggle()} aria-label={label} title={label} data-mode={theme.resolved}>
	<i class={icon} aria-hidden="true"></i>
</button>

<style lang="postcss">
	@reference "../../../app.css";

	button {
		@apply flex bg-transparent border-0 p-0 leading-none text-ink-muted text-lg cursor-pointer;
		transition: color 0.15s ease;
	}

	button:hover {
		@apply text-ink;
	}
</style>
