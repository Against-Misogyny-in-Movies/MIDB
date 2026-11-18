<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		/** A question in a `p` with `tabindex="-1"`, then its buttons. */
		children: Snippet;
	}

	let { children }: Props = $props();
</script>

<div class="plate">
	{@render children()}
</div>

<style lang="postcss">
	@reference "../../../app.css";

	/* The confirmation or form that opens under a row or a button, on `--surface-sunken`. */
	.plate {
		@apply flex flex-col gap-sm text-sm;
		padding: var(--spacing-md);
		border-radius: 12px;
		background-color: var(--surface-sunken);
	}

	.plate :global(p:focus-visible) {
		outline-offset: 2px;
	}
</style>
