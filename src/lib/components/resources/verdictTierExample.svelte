<script lang="ts">
	import { toneTokens, type VerdictTone } from '$lib/media/utils/verdict';

	type Tier = { label: string; tone: VerdictTone };

	// Mirrors SAFETY_META / REP_META in verdict.ts (kept in sync by hand).
	const groups: { axis: string; tiers: Tier[] }[] = [
		{
			axis: 'Content safety',
			tiers: [
				{ label: 'Safer to watch', tone: 'success' },
				{ label: 'Watch with caution', tone: 'warn' },
				{ label: 'Harmful content', tone: 'danger' },
				{ label: 'Not enough data', tone: 'neutral' }
			]
		},
		{
			axis: 'Representation',
			tiers: [
				{ label: 'Strong representation', tone: 'success' },
				{ label: 'Mixed representation', tone: 'warn' },
				{ label: 'Poor representation', tone: 'danger' },
				{ label: 'Not enough data', tone: 'neutral' }
			]
		}
	];

	function style(tone: VerdictTone): string {
		const t = toneTokens(tone);
		return `--tone: var(${t.fg}); --tone-soft: var(${t.soft});`;
	}
</script>

<div class="legend">
	{#each groups as group (group.axis)}
		<div class="group">
			<p class="label">{group.axis}</p>
			<ul>
				{#each group.tiers as tier (tier.label)}
					<li style={style(tier.tone)}>{tier.label}</li>
				{/each}
			</ul>
		</div>
	{/each}
</div>

<style lang="postcss">
	@reference "../../../app.css";

	.legend {
		@apply grid gap-lg;
		grid-template-columns: 1fr;
	}

	@media (min-width: 480px) {
		.legend {
			grid-template-columns: 1fr 1fr;
		}
	}

	.group {
		@apply flex flex-col gap-sm;
	}

	ul {
		@apply flex flex-col gap-xs list-none m-0 p-0;
	}

	/* A miniature of the verdict block: the tier in its tone on its tinted fill. */
	li {
		@apply self-start rounded-md text-sm font-semibold;
		padding: var(--spacing-xs) var(--spacing-sm);
		background-color: var(--tone-soft);
		color: var(--tone);
	}
</style>
