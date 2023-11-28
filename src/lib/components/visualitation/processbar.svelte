<script lang="ts">
    export let current: number = 0;
    export let total: number = 0;
    export let vertical: boolean = false;
</script>

<div class="processbar" class:vertical>
    <div class="processbar__bar" style="--current-state: {Math.round(current / total * 100)}%"></div>
</div>

<style lang="postcss">
    .processbar{
        @apply w-full h-sm bg-neutral-light;
        @apply border-neutral-light rounded-lg overflow-hidden;
    }

    .processbar__bar {
        width: var(--current-state, 0%);
        @apply bg-primary h-full;
        transition: width 0.5s ease-in-out;
    }

    .processbar.vertical {
        @apply h-full w-sm;
    }

    .processbar.vertical > .processbar__bar {
        height: var(--current-state, 0%);
        @apply w-full;
        transition: height 0.5s ease-in-out;
    }
</style>