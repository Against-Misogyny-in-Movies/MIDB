<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		/** Short heading, e.g. "Content safety". */
		label: string;
		children: Snippet;
	}

	let { label, children }: Props = $props();
</script>

<div class="sub-block">
	<h3>{label}</h3>
	<div class="sub-body">
		{@render children()}
	</div>
</div>

<style lang="postcss">
	@reference "../../../app.css";

	.sub-block {
		@apply flex flex-col gap-xs;
		margin-top: var(--spacing-sm);
	}

	h3 {
		@apply font-semibold text-ink;
	}

	.sub-body {
		@apply flex flex-col gap-sm text-ink-muted;
	}
</style>
