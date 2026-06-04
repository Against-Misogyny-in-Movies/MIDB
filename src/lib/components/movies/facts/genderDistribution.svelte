<script lang="ts">
	import type { GenderBreakdown } from '$lib/media/types/media';

	interface Props {
		cast: GenderBreakdown;
		crew: GenderBreakdown;
	}

	let { cast, crew }: Props = $props();

	function pct(count: number, total: number): number {
		if (total === 0) return 0;
		return Math.round((count / total) * 100);
	}

	const castPct = $derived({
		female: pct(cast.female, cast.total),
		male: pct(cast.male, cast.total),
		nonBinary: pct(cast.nonBinary, cast.total),
		unknown: pct(cast.unknown, cast.total)
	});

	const crewPct = $derived({
		female: pct(crew.female, crew.total),
		male: pct(crew.male, crew.total),
		nonBinary: pct(crew.nonBinary, crew.total),
		unknown: pct(crew.unknown, crew.total)
	});

	const segments = [
		{ key: 'female', label: 'Women', colorClass: 'seg-female' },
		{ key: 'male', label: 'Men', colorClass: 'seg-male' },
		{ key: 'nonBinary', label: 'Non-binary', colorClass: 'seg-nonbinary' },
		{ key: 'unknown', label: 'Unknown', colorClass: 'seg-unknown' }
	] as const;
</script>

<div class="distribution">
	{#each [{ label: 'Cast', breakdown: cast, pcts: castPct }, { label: 'Crew', breakdown: crew, pcts: crewPct }] as group (group.label)}
		<div class="group">
			<h3 class="group-label label">{group.label}</h3>

			{#if group.breakdown.total === 0}
				<p class="empty">No {group.label.toLowerCase()} data available.</p>
			{:else}
				<div class="bar" role="img" aria-label="{group.label} gender distribution">
					{#each segments as seg (seg.key)}
						{#if group.pcts[seg.key] > 0}
							<div
								class="segment {seg.colorClass}"
								style="--pct: {group.pcts[seg.key]}%"
								title="{seg.label}: {group.pcts[seg.key]}%"
							></div>
						{/if}
					{/each}
				</div>

				<ul class="legend">
					{#each segments as seg (seg.key)}
						<li class="legend-item">
							<span class="swatch {seg.colorClass}" aria-hidden="true"></span>
							<span class="legend-label">{seg.label}</span>
							<span class="legend-count">{group.breakdown[seg.key]}</span>
							<span class="legend-pct">({group.pcts[seg.key]}%)</span>
						</li>
					{/each}
				</ul>
			{/if}
		</div>
	{/each}
</div>

<style lang="postcss">
	@reference "../../../../app.css";

	.distribution {
		@apply flex flex-col gap-lg;
	}

	.group {
		@apply flex flex-col gap-sm;
	}

	.group-label {
		@apply mb-xs;
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
