<script lang="ts">
	import type { CastMember } from '$lib/media/types/media';

	interface Props {
		castMembers: CastMember[];
	}

	let { castMembers }: Props = $props();

	const LEAD_MAX = 5;
	const SUPPORTING_MAX = 15;

	const leads = $derived(castMembers.slice(0, LEAD_MAX));
	const supporting = $derived(castMembers.slice(LEAD_MAX, SUPPORTING_MAX));
	const background = $derived(castMembers.slice(SUPPORTING_MAX));

	const tiers = $derived([
		{ label: 'Leads', members: leads, range: `top ${LEAD_MAX}` },
		{ label: 'Supporting', members: supporting, range: `#${LEAD_MAX + 1}–${SUPPORTING_MAX}` },
		{ label: 'Background', members: background, range: `#${SUPPORTING_MAX + 1}+` }
	]);

	const genderLabel: Record<string, string> = {
		female: 'Women',
		male: 'Men',
		nonBinary: 'Non-binary',
		unknown: 'Unknown'
	};

	const genderClass: Record<string, string> = {
		female: 'seg-female',
		male: 'seg-male',
		nonBinary: 'seg-nonbinary',
		unknown: 'seg-unknown'
	};

	interface TierSegment {
		gender: string;
		n: number;
		pct: number;
	}

	function tierBar(members: CastMember[]): TierSegment[] {
		if (members.length === 0) return [];
		const counts: Record<string, number> = { female: 0, male: 0, nonBinary: 0, unknown: 0 };
		for (const m of members) counts[m.gender]++;
		return (Object.entries(counts) as [string, number][])
			.filter(([, n]) => n > 0)
			.map(([gender, n]) => ({ gender, n, pct: Math.round((n / members.length) * 100) }));
	}

	const legend = ['female', 'male', 'nonBinary', 'unknown'] as const;
</script>

{#if castMembers.length === 0}
	<p class="empty">No cast data available.</p>
{:else}
	<div class="cast-rep">
		<div class="cast-head">
			<ul class="legend" aria-hidden="true">
				{#each legend as gender (gender)}
					<li class="legend-item">
						<span class="swatch {genderClass[gender]}"></span>
						<span class="legend-label">{genderLabel[gender]}</span>
					</li>
				{/each}
			</ul>
		</div>

		<div class="tiers">
			{#each tiers as tier (tier.label)}
				{@const segments = tierBar(tier.members)}
				<div class="tier">
					<div class="tier-header">
						<span class="tier-label">{tier.label}</span>
						<span class="tier-range">{tier.range}</span>
					</div>
					{#if tier.members.length === 0}
						<span class="tier-empty">No data</span>
					{:else}
						<div class="tier-bar-wrap">
							<div class="tier-bar" role="img" aria-label="{tier.label} gender distribution">
								{#each segments as seg (seg.gender)}
									<div
										class="segment {genderClass[seg.gender]}"
										style="width: {seg.pct}%"
										title="{genderLabel[seg.gender]}: {seg.n} ({seg.pct}%)"
									></div>
								{/each}
							</div>
							<span class="tier-counts">
								{#each segments as seg (seg.gender)}
									<span class="count-chip" title="{genderLabel[seg.gender]}: {seg.n}">
										<span class="swatch {genderClass[seg.gender]}" aria-hidden="true"></span>
										<span class="count-n">{seg.n}</span>
									</span>
								{/each}
							</span>
						</div>
					{/if}
				</div>
			{/each}
		</div>
	</div>
{/if}

<style lang="postcss">
	@reference "../../../../app.css";

	.empty {
		@apply text-ink-muted text-sm;
	}

	.cast-rep {
		@apply flex flex-col overflow-hidden rounded-lg border border-border;
		background-color: var(--surface-raised);
	}

	/* Header: gender legend */
	.cast-head {
		@apply flex flex-wrap items-center justify-end gap-x-md gap-y-xs px-md py-sm;
		background-color: color-mix(in oklab, var(--brand) 4%, var(--surface-raised));
		border-bottom: 1px solid var(--border);
	}

	.legend {
		@apply flex flex-wrap items-center gap-x-md gap-y-xs list-none m-0 p-0;
	}

	.legend-item {
		@apply flex items-center gap-xs;
	}

	.legend-label {
		@apply text-xs text-ink-muted;
	}

	.tiers {
		@apply flex flex-col;
	}

	.tier {
		@apply grid items-center gap-sm px-md py-sm;
		grid-template-columns: 6rem 3.5rem 1fr;
		grid-template-rows: auto;
		border-bottom: 1px solid var(--border);
	}

	.tier:last-child {
		@apply border-b-0;
	}

	.tier-header {
		@apply contents;
	}

	.tier-label {
		@apply text-sm font-semibold text-ink;
	}

	.tier-range {
		@apply text-xs text-ink-muted tabular-nums;
	}

	.tier-bar-wrap {
		@apply flex items-center gap-sm;
	}

	.tier-bar {
		@apply flex overflow-hidden rounded-sm flex-1;
		height: 1rem;
		background-color: var(--border);
	}

	.segment {
		@apply h-full;
	}

	.tier-counts {
		@apply flex items-center gap-xs shrink-0;
	}

	.count-chip {
		@apply flex items-center gap-xs text-sm text-ink-muted;
	}

	.count-n {
		@apply font-semibold text-ink tabular-nums;
	}

	.tier-empty {
		@apply text-xs text-ink-muted italic;
	}

	.swatch {
		@apply inline-block rounded-xs shrink-0;
		width: 0.625rem;
		height: 0.625rem;
	}

	.seg-female {
		background-color: var(--brand);
	}
	.seg-male {
		background-color: var(--seg-male);
	}
	.seg-nonbinary {
		background-color: var(--accent-bg);
	}
	/* Unknown shares the track colour, so give it an inset edge to stay visible */
	.seg-unknown {
		background-color: var(--border);
		box-shadow: inset 0 0 0 1px color-mix(in oklab, var(--ink) 25%, transparent);
	}
	.tier-bar .seg-unknown:not(:last-child) {
		border-right: 1px solid color-mix(in oklab, var(--ink) 25%, transparent);
	}

	@media (max-width: 480px) {
		.tier {
			grid-template-columns: 5.5rem 3rem 1fr;
		}
	}
</style>
