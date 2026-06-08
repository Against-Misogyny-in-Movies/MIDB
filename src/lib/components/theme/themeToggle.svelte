<script lang="ts">
    import { onMount } from 'svelte';

    type Theme = 'light' | 'dark';

    let theme = $state<Theme>('light');

    const icon  = $derived(theme === 'dark' ? 'ri-moon-line' : 'ri-sun-line');
    const label = $derived(theme === 'dark' ? 'Theme: dark'  : 'Theme: light');

    onMount(() => {
        const stored = localStorage.getItem('theme');
        if (stored === 'light' || stored === 'dark') {
            theme = stored;
        } else {
            theme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
        }
        apply(theme);
    });

    // --brand per theme; keep in sync with app.css and app.html's pre-paint script.
    const BRAND: Record<Theme, string> = { light: '#7400b8', dark: '#c890ee' };

    function apply(t: Theme) {
        document.documentElement.dataset.theme = t;
        localStorage.setItem('theme', t);
        // Keep the mobile browser chrome tint in step with the active theme.
        document.querySelector('meta[name="theme-color"]')?.setAttribute('content', BRAND[t]);
    }

    function toggle() {
        const next: Theme = theme === 'light' ? 'dark' : 'light';
        theme = next;
        apply(next);
    }
</script>

<button
    onclick={toggle}
    aria-label={label}
    title={label}
    data-mode={theme}
>
    <i class={icon}></i>
</button>

<style lang="postcss">
    @reference "../../../app.css";

    button {
        @apply bg-surface-raised text-ink border border-border rounded-md p-xs;
        @apply hover:text-brand transition-colors cursor-pointer;
    }

    button:focus-visible {
        outline: 2px solid var(--accent);
        outline-offset: 2px;
    }
</style>
