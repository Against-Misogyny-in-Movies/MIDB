<script lang="ts">
    import type { Snippet } from 'svelte';

    interface Props {
        href: string;
        children: Snippet;
        onclick?: (e: MouseEvent) => void;
    }

    let { href, children, onclick }: Props = $props();
</script>


<a {href} {onclick}>{@render children()}</a>

<style lang="postcss">
	@reference "../../../app.css";
    a {
        @apply text-brand py-sm px-md;
        @apply font-bold;
        @apply text-base;
    }

    a:hover {
        @apply bg-surface-raised rounded-md text-brand-strong;
    }

</style>
