<script lang="ts">
    import type { Snippet } from 'svelte';

    interface Props {
        children: Snippet;
    }

    let { children }: Props = $props();
</script>


<nav>
    <ul>
        {@render children()}
    </ul>
</nav>

<style lang="postcss">
	@reference "../../../app.css";
    nav {
        @apply my-sm mx-md;
    }

    ul {
        @apply flex space-x-md;
    }
</style>
