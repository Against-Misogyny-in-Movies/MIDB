<script lang="ts">
	import LinkButton from "../form/linkButton.svelte";

    export let previous: string;
    export let previousHref: string;

    export let detailed: boolean = true;

    function toggleDetailed(event: Event) {
        event.preventDefault();
        detailed = !detailed;
    }
</script>


<main>
    <nav>
        <LinkButton href="{previousHref}"><i class="ri-arrow-left-line"></i>{previous}</LinkButton>
        <LinkButton href="?detailed=true" on:click={toggleDetailed}>show: {detailed ? "less" : "more"}</LinkButton>
    </nav>
    <slot detailed={detailed}></slot>
</main>

<style lang="postcss"> 
    main {
        @apply flex flex-col justify-center min-h-screen w-full max-w-5xl m-auto px-md;
    }
    nav {
        @apply flex justify-between items-center;
        @apply mb-sm -mx-md;
    }

    
</style>