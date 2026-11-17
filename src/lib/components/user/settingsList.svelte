<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		/** The `settingsRow`s. */
		children: Snippet;
	}

	let { children }: Props = $props();
</script>

<ul>
	{@render children()}
</ul>

<style lang="postcss">
	@reference "../../../app.css";

	ul {
		@apply m-0 p-0 list-none;
	}

	/* The hairline sits between rows only, as in the skeleton. */
	ul > :global(li + li) {
		border-top: 1px solid var(--border);
	}
</style>
