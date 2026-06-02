<script lang="ts">
    import type { Snippet } from 'svelte';

    interface Props {
        type?: "button" | "submit" | "reset";
        name?: string;
        disabled?: boolean;
        status?: "primary" | "secondary" | "success" | "warn" | "danger" | "info";
        children: Snippet;
        [key: string]: unknown;
    }

    let { type = "button", name, disabled = false, status = "primary", children, ...rest }: Props = $props();
</script>

<button class="{status}" {type} {name} {disabled} {...rest}>{@render children()}</button>

<style lang="postcss">
	@reference "../../../app.css";
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
