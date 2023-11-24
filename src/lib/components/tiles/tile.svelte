<script lang="ts">

    import Tooltip from "../help/tooltip.svelte";


    export let title: string;
    export let short: string | undefined = undefined;
    export let description: string | undefined = undefined;
    export let icon: string | undefined = undefined;
    export let el: string = 'div'

</script>


<svelte:element this={el} {...$$restProps} class="bg-component tile">
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
        @apply border-2 border-neutral-light rounded-lg p-md;
    }

    .tile:hover,
    .tile:focus {
        @apply border-neutral !important;
    }
</style>