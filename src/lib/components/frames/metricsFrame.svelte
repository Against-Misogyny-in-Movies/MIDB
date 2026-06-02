<script lang="ts">
    import type { Snippet } from 'svelte';
    import LinkButton from "../form/linkButton.svelte";

    interface Props {
        previous: string;
        previousHref: string;
        detailed?: boolean;
        children: Snippet<[boolean]>;
    }

    let { previous, previousHref, detailed = $bindable(true), children }: Props = $props();

    function toggleDetailed(event: MouseEvent) {
        event.preventDefault();
        detailed = !detailed;
    }
</script>


<main>
    <nav>
        <LinkButton href={previousHref}><i class="ri-arrow-left-line"></i>{previous}</LinkButton>
        <LinkButton href="?detailed=true" onclick={toggleDetailed}>show: {detailed ? "less" : "more"}</LinkButton>
    </nav>
    {@render children(detailed)}
</main>

<style lang="postcss">
	@reference "../../../app.css";
    main {
        @apply flex flex-col min-h-screen w-full max-w-5xl m-auto p-md;
    }
    nav {
        @apply flex justify-between items-center;
        @apply mb-sm -mx-md;
    }


</style>
