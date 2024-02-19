<script lang="ts">
    export let href: string;
    export let selected: boolean = false;
</script>

<li class:selected>
    {#if selected}
        <span>• <slot /></span>
    {:else}
        <a {href}>
            <slot />
        </a>
    {/if}
</li>

<style lang="postcss">
    li {
        @apply font-bold p-sm;
    }
    li:hover {
        @apply text-primary;
    }

    li.selected {
        @apply text-primary;
    }
</style>