<script lang="ts">
    import type { Snippet } from 'svelte';

    interface Props {
        pos?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
        children: Snippet;
    }

    let { pos = 'top-right', children }: Props = $props();
</script>

<i class="ri-information-line {pos}"></i>

{@render children()}

<style lang="postcss">
	@reference "../../../../app.css";
    i {
        @apply text-border p-xs;
        cursor: pointer;
    }

    i:hover {
        @apply text-ink-muted;
    }

    i.top-right {
        @apply absolute top-0 right-0;
    }

    i.top-left {
        @apply absolute top-0 left-0;
    }

    i.bottom-right {
        @apply absolute bottom-0 right-0;
    }

    i.bottom-left {
        @apply absolute bottom-0 left-0;
    }
</style>
