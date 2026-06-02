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
    a {
        @apply text-primary py-sm px-md;
        @apply font-bold;
        @apply text-base;
    }

    a:hover {
        @apply bg-neutral-light rounded-md text-primary-dark;
    }

</style>
