<script lang="ts">

    import Tooltip from "../help/tooltip.svelte";
    import {nanoid} from "nanoid";

    export let title: string;
    export let short: string | undefined = undefined;
    export let description: string | undefined = undefined;
    export let icon: string | undefined = undefined;
    export let link: boolean = false;
    export let ref: string;

    const formId = nanoid();

    function getArgsByType() {
        if (link) {
            return {href: ref};
        } else {
            return {for: formId};
        }
    }

</script>

{#if !link}
    <input type="checkbox" id={formId} name="ref" on:change hidden>
{/if}
<svelte:element this={link ? 'a' : 'label'} {...getArgsByType()} class="tile">
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

    input:checked + label.tile {
        @apply border-primary;
    }

    .tile:hover,
    .tile:focus {
        @apply border-neutral !important;
    }
</style>