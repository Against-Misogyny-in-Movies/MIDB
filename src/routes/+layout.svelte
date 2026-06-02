<script lang="ts">
    import type { Snippet } from 'svelte';
    import 'remixicon/fonts/remixicon.css'
    import "../app.css";

    interface Props {
        children: Snippet;
    }

    let { children }: Props = $props();
</script>

<main>
    {@render children()}
</main>


<style lang="postcss">
	@reference "../app.css";
    main {
        @apply p-md;
    }
</style>
