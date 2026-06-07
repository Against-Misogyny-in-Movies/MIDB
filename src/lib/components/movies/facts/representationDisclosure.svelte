<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		/** Verb-phrase noun shown in the toggle, e.g. "cast by billing order". */
		label: string;
		children: Snippet;
	}

	let { label, children }: Props = $props();

	let open = $state(false);
</script>

<div class="disclosure">
	<button
		class="toggle"
		type="button"
		aria-expanded={open}
		onclick={() => (open = !open)}
	>
		<i class="ri-arrow-right-s-line chevron" class:chevron--open={open} aria-hidden="true"></i>
		{open ? `Hide ${label}` : `See ${label}`}
	</button>

	{#if open}
		<div class="content">
			{@render children()}
		</div>
	{/if}
</div>

<style lang="postcss">
	@reference "../../../../app.css";

	.disclosure {
		@apply flex flex-col gap-sm;
	}

	.toggle {
		@apply flex items-center gap-xs text-xs font-medium text-ink-muted self-start;
		@apply bg-transparent border-0 p-0 cursor-pointer;
		transition: color 0.12s ease;
	}

	.toggle:hover,
	.toggle:focus-visible {
		@apply text-brand outline-none;
	}

	.chevron {
		@apply text-base shrink-0;
		transition: transform 0.18s ease;
	}

	.chevron--open {
		transform: rotate(90deg);
	}

	@media (prefers-reduced-motion: reduce) {
		.chevron {
			transition: none;
		}
	}
</style>
