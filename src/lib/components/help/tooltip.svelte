<script lang="ts">
    export let content: string;
    export let pos: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' = 'top-right';
</script>

<i class="ri-information-line {pos}"></i>

<slot></slot>

<style lang="postcss">
    i {
        @apply text-neutral-light p-xs;
        cursor: pointer;
    }

    i:hover {
        @apply text-neutral;
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



