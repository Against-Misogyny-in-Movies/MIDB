<script lang="ts">
    export let href: string;
</script>


<a {href} on:click><slot /></a>

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
