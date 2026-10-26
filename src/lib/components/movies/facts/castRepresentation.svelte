<script lang="ts">
	import type { CastMember, GenderCategory } from '$lib/media/types/media';

	interface Props {
		castMembers: CastMember[];
	}

	let { castMembers }: Props = $props();

	const LEAD_MAX = 5;
	const SUPPORTING_MAX = 15;

	const tiers = $derived([
		{ label: 'Leads', range: `Top ${LEAD_MAX}`, members: castMembers.slice(0, LEAD_MAX) },
		{
			label: 'Supporting',
			range: `${LEAD_MAX + 1}–${SUPPORTING_MAX}`,
			members: castMembers.slice(LEAD_MAX, SUPPORTING_MAX)
		},
		{
			label: 'Background',
			range: `${SUPPORTING_MAX + 1}+`,
			members: castMembers.slice(SUPPORTING_MAX)
		}
	]);

	const GENDERS: { key: GenderCategory; label: string; short: string; color: string }[] = [
		{ key: 'female', label: 'Women', short: 'W', color: '--seg-female' },
		{ key: 'male', label: 'Men', short: 'M', color: '--seg-male' },
		{ key: 'nonBinary', label: 'Non-binary', short: 'NB', color: '--seg-nonbinary' },
		{ key: 'unknown', label: 'Unknown', short: '?', color: '--seg-unknown' }
	];

	function counts(members: CastMember[]): Record<GenderCategory, number> {
		const c: Record<GenderCategory, number> = { female: 0, male: 0, nonBinary: 0, unknown: 0 };
		for (const m of members) c[m.gender]++;
		return c;
	}
</script>

{#if castMembers.length === 0}
	<p class="empty">No cast data available.</p>
{:else}
	<table class="rep-table">
		<thead>
			<tr>
				<th scope="col">Billing</th>
				<th scope="col" class="bar-col"><span class="sr-only">Gender split</span></th>
				{#each GENDERS as g (g.key)}
					<th scope="col" class="count-col" title={g.label}>
						<span class="swatch" style="--seg: var({g.color});" aria-hidden="true"></span>
						<abbr title={g.label}>{g.short}</abbr>
					</th>
				{/each}
			</tr>
		</thead>
		<tbody>
			{#each tiers as tier (tier.label)}
				{@const c = counts(tier.members)}
				{@const total = tier.members.length}
				<tr>
					<th scope="row">
						<span class="tier-label">{tier.label}</span>
						<span class="tier-range tabular-nums">{tier.range}</span>
					</th>
					<td class="bar-col">
						{#if total > 0}
							<span
								class="bar"
								role="img"
								aria-label="{tier.label}: {Math.round((c.female / total) * 100)}% women"
							>
								{#each GENDERS as g (g.key)}
									{#if c[g.key] > 0}
										<span
											class="seg"
											style="width: {(c[g.key] / total) * 100}%; --seg: var({g.color});"
										></span>
									{/if}
								{/each}
							</span>
						{:else}
							<span class="none">No data</span>
						{/if}
					</td>
					{#each GENDERS as g (g.key)}
						<td class="count-col tabular-nums">{total > 0 ? c[g.key] : '–'}</td>
					{/each}
				</tr>
			{/each}
		</tbody>
	</table>
{/if}

<style lang="postcss">
	@reference "../../../../app.css";

	.empty {
		@apply text-ink-muted;
	}

	.rep-table {
		@apply w-full text-sm border-collapse;
	}

	th,
	td {
		@apply text-left font-normal align-middle;
		padding: var(--spacing-sm) var(--spacing-sm) var(--spacing-sm) 0;
		border-bottom: 1px solid var(--border);
	}

	thead th {
		@apply text-ink-muted whitespace-nowrap;
	}

	tbody th {
		@apply whitespace-nowrap;
	}

	.tier-label {
		@apply font-medium text-ink;
	}

	.tier-range {
		@apply text-ink-muted ml-xs;
	}

	.bar-col {
		width: 100%;
		min-width: 4rem;
	}

	.bar {
		@apply flex overflow-hidden rounded-sm;
		height: 0.625rem;
		gap: 2px;
		background-color: var(--surface-sunken);
	}

	.seg {
		@apply h-full;
		background-color: var(--seg);
	}

	.none {
		@apply text-ink-muted;
	}

	.count-col {
		@apply text-right font-medium text-ink;
		padding-left: var(--spacing-sm);
		padding-right: 0;
		min-width: 2.25rem;
	}

	thead .count-col {
		@apply font-normal text-ink-muted;
	}

	abbr {
		text-decoration: none;
	}

	.swatch {
		@apply inline-block rounded-xs mr-1;
		width: 0.5rem;
		height: 0.5rem;
		background-color: var(--seg);
	}
</style>
