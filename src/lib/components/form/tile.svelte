<script lang="ts">

    import Tooltip from "../help/tooltip.svelte";

    export let title: string;
    export let short: string | undefined = undefined;
    export let description: string | undefined = undefined;
    export let icon: string | undefined = undefined;
    export let link: boolean = false;
    export let selected: boolean = false;

    function getArgsByType() {
        if (link) {
            return {href: link};
        } else {
            return {};
        }
    }

</script>


<svelte:element this={link ? 'a' : 'div'} {...getArgsByType()} on:click class:selected class="tile">
    <h2>
        <slot name="icon"><i class="{icon}"></i></slot>
        {title}
    </h2>
    {#if short}<small>{short}</small>{/if}
    {#if description}
        <Tooltip pos="top-right" content={description}></Tooltip>
    {/if}
</svelte:element>

<style lang="postcss">
    .tile {
        @apply relative block cursor-pointer;
        @apply border-2 border-neutral-light rounded-lg p-4;
    }

    .tile.selected {
        @apply border-primary;
    }

    .tile:hover,
    .tile:focus {
        @apply border-neutral-dark;
    }
</style>