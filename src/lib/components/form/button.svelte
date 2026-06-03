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
        @apply bg-brand text-accent-ink font-bold rounded-md p-sm;
        @apply border-2 border-brand hover:bg-brand-strong;
        @apply cursor-pointer;
    }

    button.secondary {
        @apply bg-secondary text-secondary-fg;
        @apply border-secondary hover:bg-secondary-soft;
    }

    button.success {
        @apply bg-success text-success-fg;
        @apply border-success hover:bg-success-soft;
    }

    button.warn {
        @apply bg-warn text-warn-fg hover:bg-warn-soft;
        @apply border-warn;
    }

    button.danger {
        @apply bg-danger text-danger-fg hover:bg-danger-soft;
        @apply border-danger;
    }

    button.info {
        @apply bg-info text-info-fg hover:bg-info-soft;
        @apply border-info;
    }


    button:disabled {
        @apply bg-surface-raised text-ink-muted;
        @apply border-border;
        @apply cursor-not-allowed;
    }
</style>
