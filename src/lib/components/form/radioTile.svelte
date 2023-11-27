<script lang="ts">
    import {nanoid} from "nanoid";
    import Tile from "$lib/components/tiles/tile.svelte"

    export let title: string;
    export let short: string;
    export let description: string | undefined = undefined;
    export let icon: string | undefined = undefined
    export let name: string;
    export let value: string;


    const formId = nanoid();


</script>

<input type="radio" id={formId} {name} {value} on:change hidden>
<Tile el="label" {title} {icon} {description} {short} for={formId}>
    <slot name="icon"></slot>
</Tile>

<style lang="postcss">
    input:checked + :global(label.tile) {
        @apply border-primary;
    }
</style>
