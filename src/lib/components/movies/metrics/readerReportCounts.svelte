<script lang="ts">
	import type { ReportCounts } from '#lib/media/types/reader-reports.ts';
	import {
		CONCERN_FLAGS,
		REPORT_CATEGORIES,
		REPORT_FRAMING_LABELS,
		reportFraming
	} from '#lib/media/utils/readerReports.ts';
	import { categoryFigures, type Figure } from '#lib/media/utils/reportFigures.ts';

	interface Props {
		counts: ReportCounts;
	}

	let { counts }: Props = $props();

	const framings = $derived(
		reportFraming
			.map((f) => ({ label: REPORT_FRAMING_LABELS[f], n: counts.framing[f] ?? 0 }))
			.filter((f) => f.n > 0)
	);
	/** The reports that said sexual violence is Present: the only ones asked the flags. */
	const presentCount = $derived(counts.categories.sexual.present ?? 0);
</script>

{#snippet figures(items: Figure[], of: number | null)}
	<span class="figures">
		{#each items as item, i (item.label)}
			{#if i > 0}<span class="sep" aria-hidden="true"> · </span>{/if}
			<span class="figure">{item.label} <span class="n">{item.n}</span></span>
		{/each}
		{#if of !== null}<span class="of">, of {of}</span>{/if}
	</span>
{/snippet}

<ul class="rows">
	{#each REPORT_CATEGORIES as category (category.key)}
		{@const items = categoryFigures(counts, category.key)}
		<li class="row">
			{#if category.key === 'sexual' && presentCount > 0}
				<details class="expand">
					<summary class="line">
						<span class="name">{category.label}</span>
						{@render figures(items, counts.total)}
						<i class="chevron ri-arrow-down-s-line" aria-hidden="true"></i>
					</summary>
					<p class="label flags-note">
						Concerns among the {presentCount}
						{presentCount === 1 ? 'report' : 'reports'} that said sexual violence is present.
					</p>
					<ul class="flags">
						{#each CONCERN_FLAGS as flag (flag.key)}
							{@const tally = counts.flags[flag.key]}
							{@const raised = tally.yes > 0}
							<li class="flag" class:flag--raised={raised}>
								<span class="flag-marker" aria-hidden="true">
									<i class={raised ? 'ri-alert-line' : 'ri-subtract-line'}></i>
								</span>
								<span class="flag-label">{flag.label}</span>
								<span class="flag-figures">
									Yes <span class="n">{tally.yes}</span> · No <span class="n">{tally.no}</span> ·
									Not sure
									<span class="n">{tally.unsure}</span>
								</span>
							</li>
						{/each}
					</ul>
				</details>
			{:else}
				<div class="line">
					<span class="name">{category.label}</span>
					{@render figures(items, counts.total)}
				</div>
			{/if}
		</li>
	{/each}
	{#if framings.length > 0}
		<li class="row">
			<div class="line">
				<span class="name">Framing of the violence</span>
				{@render figures(framings, null)}
			</div>
		</li>
	{/if}
</ul>

<style lang="postcss">
	@reference "../../../../app.css";

	.rows {
		@apply list-none m-0 p-0;
	}

	.row + .row {
		border-top: 1px solid var(--border);
	}

	.line {
		@apply flex flex-col text-sm;
		gap: 2px;
		padding-block: var(--spacing-sm);
	}

	@media (min-width: 40rem) {
		.line {
			@apply grid items-baseline;
			grid-template-columns: 13rem 1fr;
			gap: var(--spacing-md);
		}

		.expand .line {
			grid-template-columns: 13rem 1fr 1.25rem;
		}
	}

	.name {
		@apply font-semibold text-ink;
	}

	.figures {
		@apply text-ink-muted;
	}

	.n {
		@apply font-semibold text-ink tabular-nums;
	}

	.of {
		@apply tabular-nums;
	}

	.expand summary {
		@apply cursor-pointer select-none;
		list-style: none;
		position: relative;
	}

	.expand summary::-webkit-details-marker {
		display: none;
	}

	.chevron {
		@apply text-xl text-ink-muted;
		position: absolute;
		top: var(--spacing-sm);
		right: 0;
		transition: transform 0.15s ease;
	}

	.expand[open] .chevron {
		transform: rotate(180deg);
	}

	.flags-note {
		margin: 0 0 var(--spacing-xs);
	}

	.flags {
		@apply grid list-none m-0 p-0;
		grid-template-columns: repeat(auto-fill, minmax(17rem, 1fr));
		gap: 0 var(--spacing-lg);
		padding-bottom: var(--spacing-sm);
	}

	/* Shared marker pattern: see docs/architecture.md, Shared marker pattern. */
	.flag {
		@apply grid items-center gap-x-sm text-sm text-ink-muted;
		grid-template-columns: 1.375rem 1fr;
		padding-block: var(--spacing-xs);
	}

	.flag--raised .flag-label {
		@apply text-ink font-medium;
	}

	.flag-marker {
		@apply flex items-center justify-center rounded-full text-xs shrink-0;
		width: 1.375rem;
		height: 1.375rem;
		color: var(--ink-muted);
		box-shadow: inset 0 0 0 1px var(--border);
	}

	.flag--raised .flag-marker {
		background-color: var(--warn-soft);
		color: var(--warn);
		box-shadow: none;
	}

	.flag-label {
		@apply leading-snug;
	}

	.flag-figures {
		@apply text-xs;
		grid-column: 2;
	}

	@media (prefers-reduced-motion: reduce) {
		.chevron {
			transition: none;
		}
	}
</style>
