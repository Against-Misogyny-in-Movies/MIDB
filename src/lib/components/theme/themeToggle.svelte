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

	/* A 2.75rem touch target around the 1.125rem icon. The negative margin gives the extra back,
	   so the icon sits where it did and the header neither grows nor widens. */
	@media (pointer: coarse) {
		button {
			@apply items-center justify-center;
			box-sizing: border-box;
			width: 2.75rem;
			height: 2.75rem;
			margin-inline: calc((1.125rem - 2.75rem) / 2);
		}
	}
</style>
