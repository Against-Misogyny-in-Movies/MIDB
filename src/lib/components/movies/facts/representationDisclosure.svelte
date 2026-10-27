<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		/** Noun phrase shown in the toggle, e.g. "cast by billing order". */
		label: string;
		children: Snippet;
	}

	let { label, children }: Props = $props();

	let open = $state(false);
</script>

<div class="disclosure">
	<button class="toggle" type="button" aria-expanded={open} onclick={() => (open = !open)}>
		{open ? `Hide ${label}` : `Show ${label}`}
		<i class="ri-arrow-down-s-line chevron" class:chevron--open={open} aria-hidden="true"></i>
	</button>

	{#if open}
		{@render children()}
	{/if}
</div>

<style lang="postcss">
	@reference "../../../../app.css";

	.disclosure {
		@apply flex flex-col gap-sm;
	}

	.toggle {
		@apply inline-flex items-center gap-xs self-start text-sm bg-transparent border-0 p-0 cursor-pointer;
		color: var(--brand);
	}

	.toggle:hover {
		@apply underline underline-offset-4;
	}

	.chevron {
		transition: transform 0.15s ease;
	}

	.chevron--open {
		transform: rotate(180deg);
	}

	@media (prefers-reduced-motion: reduce) {
		.chevron {
			transition: none;
		}
	}
</style>
