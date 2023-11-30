<script lang="ts">
    export let type: "button" | "submit" | "reset" = "button";
    export let name: string | undefined = undefined;
    export let disabled: boolean = false;
    export let status: "primary" | "secondary" | "success" | "warn" | "danger" | "info"  = "primary";
</script>

<button class="{status}" {type} {name} {disabled} {...$$restProps}><slot /></button>

<style lang="postcss">
    button {
        @apply bg-primary text-white font-bold rounded-md p-sm;
        @apply border-2 border-primary hover:bg-primary-light;
        @apply cursor-pointer;
    }

    button.secondary {
        @apply bg-secondary;
        @apply border-secondary hover:bg-secondary-light;
    }

    button.success {
        @apply bg-success;
        @apply border-success hover:bg-success-light;
    }

    button.warn {
        @apply bg-warn hover:bg-warn-light;
        @apply border-warn;
    }

    button.danger {
        @apply bg-danger hover:bg-danger-light;
        @apply border-danger;
    }

    button.info {
        @apply bg-info hover:bg-info-light;
        @apply border-info;
    }


    button:disabled {
        @apply bg-neutral-light text-neutral;
        @apply border-neutral;
        @apply cursor-not-allowed;
    }
</style>