<script lang="ts">
	import type { GenderBreakdown } from '$lib/media/types/media';

	interface Props {
		/** "Cast" or "Crew": labels the bar and the empty-state copy. */
		label: string;
		breakdown: GenderBreakdown;
	}

	let { label, breakdown }: Props = $props();

	function pct(count: number, total: number): number {
		if (total === 0) return 0;
		return Math.round((count / total) * 100);
	}

	const segments = [
		{ key: 'female', label: 'Women', color: '--seg-female' },
		{ key: 'male', label: 'Men', color: '--seg-male' },
		{ key: 'nonBinary', label: 'Non-binary', color: '--seg-nonbinary' },
		{ key: 'unknown', label: 'Unknown', color: '--seg-unknown' }
	] as const;
</script>

{#if breakdown.total === 0}
	<p class="empty">No {label.toLowerCase()} data.</p>
{:else}
	<div class="distribution">
		<div class="bar" role="img" aria-label="{label} gender distribution">
			{#each segments as seg (seg.key)}
				{@const p = pct(breakdown[seg.key], breakdown.total)}
				{#if p > 0}
					<div class="segment" style="--pct: {p}%; --seg: var({seg.color});"></div>
				{/if}
			{/each}
		</div>

		<ul class="legend">
			{#each segments as seg (seg.key)}
				<li class="legend-item">
					<span class="swatch" style="--seg: var({seg.color});" aria-hidden="true"></span>
					<span>{seg.label}</span>
					<span class="count tabular-nums"
						>{breakdown[seg.key]}
						<span class="pct">({pct(breakdown[seg.key], breakdown.total)}%)</span></span
					>
				</li>
			{/each}
		</ul>
	</div>
{/if}

<style lang="postcss">
	@reference "../../../../app.css";

	.distribution {
		@apply flex flex-col gap-sm;
	}

	.empty {
		@apply text-ink-muted;
	}

	.bar {
		@apply flex overflow-hidden rounded-full;
		height: 0.75rem;
		gap: 2px;
		background-color: var(--surface-sunken);
	}

	.segment {
		@apply h-full;
		width: var(--pct);
		background-color: var(--seg);
	}

	.legend {
		@apply flex flex-wrap gap-x-lg gap-y-xs list-none p-0 m-0 text-sm;
	}

	.legend-item {
		@apply flex items-center gap-xs;
	}

	.swatch {
		@apply inline-block rounded-full shrink-0;
		width: 0.625rem;
		height: 0.625rem;
		background-color: var(--seg);
	}

	.count {
		@apply font-medium text-ink;
	}

	.pct {
		@apply font-normal text-ink-muted;
	}
</style>
