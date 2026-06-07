<script lang="ts">
    import type { Snippet } from 'svelte';
    import {nanoid} from "nanoid";
    import Tile from "$lib/components/ui/tile/tile.svelte"

    interface Props {
        title: string;
        short: string;
        description?: string;
        icon?: string;
        name: string;
        value: string;
        icon_snippet?: Snippet;
        onchange?: (e: Event) => void;
    }

    let { title, short, description, icon, name, value, icon_snippet, onchange }: Props = $props();

    const formId = nanoid();
</script>

<input type="radio" id={formId} {name} {value} {onchange} hidden>
<Tile el="label" {title} {icon} {description} short={short} for={formId} {icon_snippet} />

<style lang="postcss">
	@reference "../../../../app.css";
    input:checked + :global(label.tile) {
        @apply border-brand;
    }
</style>
