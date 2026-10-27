<script lang="ts">
	import { onMount } from 'svelte';

	type Theme = 'light' | 'dark';

	let theme = $state<Theme>('light');

	const icon = $derived(theme === 'dark' ? 'ri-moon-line' : 'ri-sun-line');
	const label = $derived(theme === 'dark' ? 'Theme: dark' : 'Theme: light');

	onMount(() => {
		const stored = localStorage.getItem('theme');
		if (stored === 'light' || stored === 'dark') {
			theme = stored;
		} else {
			theme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
		}
		apply(theme);
	});

	// --surface per theme; keep in sync with app.css and app.html's pre-paint script.
	const CHROME: Record<Theme, string> = { light: '#fbfafc', dark: '#141217' };

	function apply(t: Theme) {
		document.documentElement.dataset.theme = t;
		localStorage.setItem('theme', t);
		// Keep the mobile browser chrome tint in step with the active theme.
		document.querySelector('meta[name="theme-color"]')?.setAttribute('content', CHROME[t]);
	}

	function toggle() {
		const next: Theme = theme === 'light' ? 'dark' : 'light';
		theme = next;
		apply(next);
	}
</script>

<button onclick={toggle} aria-label={label} title={label} data-mode={theme}>
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
