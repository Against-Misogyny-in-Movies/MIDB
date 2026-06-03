<script lang="ts">
    import type { Snippet } from 'svelte';

    interface Props {
        href: string;
        selected?: boolean;
        children: Snippet;
    }

    let { href, selected = false, children }: Props = $props();
</script>

<li class:selected>
    {#if selected}
        <span>• {@render children()}</span>
    {:else}
        <a {href}>
            {@render children()}
        </a>
    {/if}
</li>

<style lang="postcss">
	@reference "../../../app.css";
    li {
        @apply font-bold p-sm;
    }
    li:hover {
        @apply text-brand;
    }

    li.selected {
        @apply text-brand;
    }
</style>
