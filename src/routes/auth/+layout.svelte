<script lang="ts">
    import type { Snippet } from 'svelte';

    interface Props {
        children: Snippet;
    }

    let { children }: Props = $props();
</script>

<main>
    {@render children()}
</main>

<style lang="postcss">
	@reference "../../app.css";
    main {
        @apply flex flex-col items-center justify-center h-screen;
    }
</style>
