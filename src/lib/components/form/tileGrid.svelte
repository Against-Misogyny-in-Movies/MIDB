<script lang="ts">

    export let detailed: boolean = true;
</script>

<div class:detailed>
    <slot></slot>  
</div>


<style lang="postcss">
    div {
        @apply grid gap-4 place-content-center;
        grid-template-columns: repeat(var(--grid-cols), minmax(0, var(--max-width, 1fr))); 
    }

    div:not(.detailed) > :global(.tile) {
        @apply truncate;
    }
</style>