<script lang="ts">
    import type { Snippet } from 'svelte';

    interface Props {
        title: string;
        description?: string;
        icon?: string;
        el?: string;
        icon_snippet?: Snippet;
        [key: string]: unknown;
    }

    let { title, description, icon, el = 'div', icon_snippet, ...rest }: Props = $props();
</script>


<svelte:element this={el} {...rest} class="bg-component tile">
    <h2>
        {#if icon_snippet}
            {@render icon_snippet()}
        {:else}
            <i class="{icon}"></i>
        {/if}
        {title}
    </h2>
    {#if description}<small>{description}</small>{/if}
</svelte:element>


<style lang="postcss">
	@reference "../../../app.css";
    .tile {
        @apply relative block cursor-pointer;
        @apply border-2 border-border rounded-lg p-md;
    }

    .tile:hover,
    .tile:focus {
        @apply border-ink-muted!;
    }
</style>
