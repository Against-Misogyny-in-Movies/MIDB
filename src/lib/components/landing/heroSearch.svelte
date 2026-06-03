<script lang="ts">
    import { goto } from '$app/navigation';
    import SearchForm from '$lib/components/search/searchForm.svelte';

    let submitted = false;

    function handleAction(query: string) {
        if (!submitted) return;
        submitted = false;
        if (query.trim()) {
            goto('/search?q=' + encodeURIComponent(query.trim()));
        }
    }

    function handleSubmit() {
        submitted = true;
    }
</script>

<div class="wrap" onsubmit={handleSubmit}>
    <SearchForm action="/search" method="get" onaction={handleAction} />
</div>

<style lang="postcss">
    @reference "../../../app.css";

    .wrap {
        @apply w-full;
    }

    .wrap :global(form button[type="submit"]) {
        @apply bg-accent-bg text-accent-ink border-accent-bg;
    }

    .wrap :global(form button[type="submit"]:hover) {
        @apply opacity-90;
    }
</style>
