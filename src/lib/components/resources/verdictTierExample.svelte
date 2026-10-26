<script lang="ts">
	import Badge from '$lib/components/ui/badge.svelte';
	import type { BadgeTone } from '$lib/media/utils/tones';

	// Mirrors SAFETY_META / REP_META in verdict.ts (kept in sync by hand).
	const groups: { axis: string; tiers: { label: string; tone: BadgeTone }[] }[] = [
		{
			axis: 'Content safety',
			tiers: [
				{ label: 'Safer to watch', tone: 'pos' },
				{ label: 'Watch with caution', tone: 'mid' },
				{ label: 'Harmful content', tone: 'neg' },
				{ label: 'Not enough data', tone: 'neutral' }
			]
		},
		{
			axis: 'Representation',
			tiers: [
				{ label: 'Strong representation', tone: 'pos' },
				{ label: 'Mixed representation', tone: 'mid' },
				{ label: 'Poor representation', tone: 'neg' },
				{ label: 'Not enough data', tone: 'neutral' }
			]
		}
	];
</script>

<div class="legend">
	{#each groups as group (group.axis)}
		<div class="group">
			<p class="axis">{group.axis}</p>
			<div class="tiers">
				{#each group.tiers as tier (tier.label)}
					<Badge tone={tier.tone} size="md">{tier.label}</Badge>
				{/each}
			</div>
		</div>
	{/each}
</div>

<style lang="postcss">
	@reference "../../../app.css";

	.legend {
		@apply flex flex-col gap-md;
		padding: 16px;
		border-radius: 12px;
		background-color: var(--brand-wash);
	}

	.axis {
		@apply text-xs font-medium text-ink-muted;
		margin-bottom: 6px;
	}

	.tiers {
		@apply flex flex-wrap;
		gap: 6px;
	}
</style>
