<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { BadgeTone } from '$lib/media/utils/tones';

	interface Props {
		tone?: BadgeTone;
		/** `sm` sits in table rows and headings; `md` in looser layouts. */
		size?: 'sm' | 'md';
		busy?: boolean;
		children: Snippet;
	}

	let { tone = 'neutral', size = 'sm', busy = false, children }: Props = $props();
</script>

<span class="badge badge--{tone} badge--{size}" aria-busy={busy || undefined}>
	{@render children()}
</span>

<style lang="postcss">
	@reference "../../../app.css";

	.badge {
		@apply inline-flex items-center whitespace-nowrap font-medium;
		border-radius: 9999px;
		font-variant-numeric: tabular-nums;
	}

	.badge--sm {
		padding: 2px 10px;
		font-size: 0.75rem;
		line-height: 1.33;
	}

	.badge--md {
		padding: 4px 12px;
		font-size: 0.875rem;
		line-height: 1.43;
	}

	.badge--pos {
		background-color: var(--success-soft);
		color: var(--success);
	}

	.badge--mid {
		background-color: var(--warn-soft);
		color: var(--warn);
	}

	.badge--neg {
		background-color: var(--danger-soft);
		color: var(--danger);
	}

	.badge--neutral {
		background-color: var(--secondary-soft);
		color: var(--ink-muted);
	}

	.badge--brand {
		background-color: color-mix(in oklab, var(--brand) 14%, var(--surface-raised));
		color: var(--brand);
	}
</style>
