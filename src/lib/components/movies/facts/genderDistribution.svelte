<script lang="ts">
	import type { GenderBreakdown } from '$lib/media/types/media';

	interface Props {
		/** "Cast" or "Crew" — labels the group and the empty-state copy. */
		label: string;
		breakdown: GenderBreakdown;
	}

	let { label, breakdown }: Props = $props();

	function pct(count: number, total: number): number {
		if (total === 0) return 0;
		return Math.round((count / total) * 100);
	}

	const pcts = $derived({
		female: pct(breakdown.female, breakdown.total),
		male: pct(breakdown.male, breakdown.total),
		nonBinary: pct(breakdown.nonBinary, breakdown.total),
		unknown: pct(breakdown.unknown, breakdown.total)
	});

	const segments = [
		{ key: 'female', label: 'Women', colorClass: 'seg-female' },
		{ key: 'male', label: 'Men', colorClass: 'seg-male' },
		{ key: 'nonBinary', label: 'Non-binary', colorClass: 'seg-nonbinary' },
		{ key: 'unknown', label: 'Unknown', colorClass: 'seg-unknown' }
	] as const;
</script>

<div class="group">
	{#if breakdown.total === 0}
		<p class="empty">No {label.toLowerCase()} data available.</p>
	{:else}
		<div class="bar" role="img" aria-label="{label} gender distribution">
			{#each segments as seg (seg.key)}
				{#if pcts[seg.key] > 0}
					<div
						class="segment {seg.colorClass}"
						style="--pct: {pcts[seg.key]}%"
						title="{seg.label}: {pcts[seg.key]}%"
					></div>
				{/if}
			{/each}
		</div>

		<ul class="legend">
			{#each segments as seg (seg.key)}
				<li class="legend-item">
					<span class="swatch {seg.colorClass}" aria-hidden="true"></span>
					<span class="legend-label">{seg.label}</span>
					<span class="legend-count">{breakdown[seg.key]}</span>
					<span class="legend-pct">({pcts[seg.key]}%)</span>
				</li>
			{/each}
		</ul>
	{/if}
</div>

<style lang="postcss">
	@reference "../../../../app.css";

	.group {
		@apply flex flex-col gap-sm;
	}

	.empty {
		@apply text-ink-muted text-sm;
	}

	.bar {
		@apply flex overflow-hidden rounded-sm;
		height: 1.5rem;
		background-color: var(--border);
	}

	.segment {
		width: var(--pct, 0%);
		@apply h-full;
	}

	/* Neutral palette — no value judgments */
	.seg-female {
		background-color: var(--brand);
	}
	.seg-male {
		background-color: var(--seg-male);
	}
	.seg-nonbinary {
		background-color: var(--accent-bg);
	}
	.seg-unknown {
		background-color: var(--border);
	}

	.legend {
		@apply flex flex-wrap gap-x-md gap-y-xs list-none p-0 m-0;
	}

	.legend-item {
		@apply flex items-center gap-xs text-sm;
	}

	.swatch {
		@apply inline-block rounded-xs;
		width: 0.75rem;
		height: 0.75rem;
		flex-shrink: 0;
	}

	.legend-label {
		@apply text-ink;
	}

	.legend-count {
		@apply text-ink-muted;
	}

	.legend-pct {
		@apply text-ink-muted;
	}
</style>
