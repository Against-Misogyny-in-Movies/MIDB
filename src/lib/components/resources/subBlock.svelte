<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		/** Short heading, e.g. "What it is", "How it works". */
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
	}

	h3 {
		@apply font-semibold text-ink;
	}

	.sub-body {
		@apply flex flex-col gap-sm text-ink-muted;
	}
</style>
