<script lang="ts">
    interface Props {
        current?: number;
        total?: number;
        vertical?: boolean;
    }

    let { current = 0, total = 0, vertical = false }: Props = $props();
</script>

<div class="progressbar" class:vertical>
    <div class="progressbar__bar" style="--current-state: {Math.round(current / total * 100)}%"></div>
</div>

<style lang="postcss">
    .progressbar{
        @apply w-full h-sm bg-neutral-light;
        @apply border-neutral-light rounded-lg overflow-hidden;
    }

    .progressbar__bar {
        width: var(--current-state, 0%);
        @apply bg-primary h-full;
        transition: width 0.5s ease-in-out;
    }

    .progressbar.vertical {
        @apply h-full w-sm;
    }

    .progressbar.vertical > .progressbar__bar {
        height: var(--current-state, 0%);
        @apply w-full;
        transition: height 0.5s ease-in-out;
    }
</style>
