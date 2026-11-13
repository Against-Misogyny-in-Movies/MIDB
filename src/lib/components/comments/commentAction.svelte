<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		/** Set when the action opens a panel below it. */
		expanded?: boolean;
		/** Set on a toggle that is on (the reader's vote). */
		pressed?: boolean;
		disabled?: boolean;
		/** The accessible name of an icon-only action. */
		label?: string;
		/** The id of the element that describes the action (a vote's score). */
		describedby?: string;
		/** An icon-only action is square. */
		icon?: boolean;
		onclick: () => void;
		children: Snippet;
	}

	let {
		expanded,
		pressed,
		disabled = false,
		label,
		describedby,
		icon = false,
		onclick,
		children
	}: Props = $props();
</script>

<button
	class="action"
	class:action--icon={icon}
	type="button"
	aria-label={label}
	aria-describedby={describedby}
	aria-expanded={expanded}
	aria-pressed={pressed}
	{disabled}
	{onclick}
>
	{@render children()}
</button>

<style lang="postcss">
	@reference "../../../app.css";

	/* A quiet text action: no fill until hovered. Icon-only ones (votes) are square. */
	.action {
		@apply inline-flex items-center justify-center text-sm font-medium text-ink-muted;
		min-height: 2rem;
		padding-inline: var(--spacing-sm);
		border: 0;
		border-radius: 8px;
		background: none;
		cursor: pointer;
		transition:
			color 0.15s ease,
			background-color 0.15s ease;
	}

	.action:hover:not(:disabled) {
		@apply text-ink;
		background-color: var(--surface-sunken);
	}

	.action:active:not(:disabled) {
		background-color: var(--surface-sunken);
	}

	.action:disabled {
		cursor: not-allowed;
		opacity: 0.55;
	}

	.action--icon {
		min-width: 2rem;
		padding-inline: 0;
		font-size: 1.125rem;
	}

	.action[aria-pressed='true'] {
		color: var(--brand);
		background-color: color-mix(in oklab, var(--brand) 14%, transparent);
	}

	@media (pointer: coarse) {
		.action {
			min-height: 2.75rem;
		}

		.action--icon {
			min-width: 2.75rem;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.action {
			transition: none;
		}
	}
</style>
