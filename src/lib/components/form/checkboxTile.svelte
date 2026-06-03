<script lang="ts">
    import type { Snippet } from 'svelte';
    import {nanoid} from "nanoid";
    import Tile from "$lib/components/tiles/tile.svelte"

    interface Props {
        title: string;
        description?: string;
        icon?: string;
        name: string;
        icon_snippet?: Snippet;
        onchange?: (e: Event) => void;
    }

    let { title, description, icon, name, icon_snippet, onchange }: Props = $props();

    const formId = nanoid();
</script>

<input type="checkbox" id={formId} {name} {onchange} hidden>
<Tile el="label" {title} {icon} {description} for={formId} {icon_snippet} />

<style lang="postcss">
	@reference "../../../app.css";
    input:checked + :global(label.tile) {
        @apply border-brand;
    }
</style>
