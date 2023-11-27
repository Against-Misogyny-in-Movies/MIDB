<script lang="ts">
    export let type: "button" | "submit" | "reset" = "button";
    export let name: string | undefined = undefined;
    export let disabled: boolean = false;
</script>

<button {type} {name} {disabled}><slot /></button>

<style lang="postcss">
    button {
        @apply bg-primary text-white font-bold rounded-md p-sm;
        @apply border-2 border-primary;
        @apply cursor-pointer;
    }

    button:hover {
        @apply bg-primary-light;
    }

    button:disabled {
        @apply bg-neutral-light text-neutral;
        @apply border-neutral;
        @apply cursor-not-allowed;
    }
</style>