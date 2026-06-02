<script lang="ts">
    import type { Snippet } from 'svelte';

    interface Props {
        detailed?: boolean;
        children: Snippet;
    }

    let { detailed = true, children }: Props = $props();
</script>

<div class:detailed>
    {@render children()}
</div>


<style lang="postcss">
	@reference "../../../app.css";
    div {
        @apply grid gap-md place-content-center;
        grid-template-columns: repeat(var(--grid-cols), minmax(0, var(--max-width, 1fr)));
    }

    div:not(.detailed) > :global(.tile) {
        @apply truncate;
    }
</style>
