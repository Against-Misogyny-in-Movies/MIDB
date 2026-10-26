<script lang="ts">
	import type { PageData } from './$types';
	import DetailHeader from '$lib/components/movies/facts/detailHeader.svelte';
	import FactGrid from '$lib/components/movies/facts/factGrid.svelte';
	import SourceIndex from '$lib/components/movies/facts/sourceIndex.svelte';
	import VerdictPanel from '$lib/components/movies/facts/verdictPanel.svelte';
	import CastAndCrew from '$lib/components/movies/facts/castAndCrew.svelte';
	import CollapsibleSection from '$lib/components/movies/sections/collapsibleSection.svelte';
	import UmMetricSection from '$lib/components/movies/metrics/umMetricSection.svelte';
	import DddMetricSection from '$lib/components/movies/metrics/dddMetricSection.svelte';
	import { BECHDEL_TIERS } from '$lib/media/utils/metrics';
	import { TitleView } from '$lib/media/utils/titleView.svelte.js';

	const BECHDEL_CRITERIA = BECHDEL_TIERS.slice(0, 3);

	let { data }: { data: PageData } = $props();
	const view = new TitleView(() => data, 'movie');
	const movie = $derived(view.media);
	const bechdel = $derived(data.bechdel);
</script>

<article class="title-page">
	<DetailHeader media={movie}>
		{#snippet verdict()}
			<VerdictPanel safety={view.safety} representation={view.representation} />
		{/snippet}
		<SourceIndex items={view.sources} />
	</DetailHeader>

	<div class="sections">
		<div id="bechdel">
			<CollapsibleSection
				title="Bechdel Test"
				status={bechdel ? `${bechdel.rating}/3` : 'No data'}
				tone={bechdel ? 'data' : 'empty'}
				open={bechdel !== null}
				sourceLabel={bechdel ? 'BechdelTest.com' : undefined}
				sourceHref={bechdel ? `https://bechdeltest.com/view/${bechdel.bechdelId}` : undefined}
				learnHref="/resources#bechdel"
			>
				{#if bechdel}
					<ol class="bechdel-criteria">
						{#each BECHDEL_CRITERIA as criterion, i (criterion.level)}
							{@const met = i < bechdel.rating}
							<li class="criterion" class:criterion--met={met}>
								<span class="criterion-marker" aria-hidden="true">
									<i class={met ? 'ri-check-line' : 'ri-close-line'}></i>
								</span>
								<span>{criterion.label}</span>
								<span class="sr-only">{met ? '(met)' : '(not met)'}</span>
							</li>
						{/each}
					</ol>
					<p class="meta-note tabular-nums">Based on {bechdel.numVotes.toLocaleString()} votes.</p>
				{:else}
					<p class="no-data">This movie is not in the Bechdel Test database.</p>
				{/if}
			</CollapsibleSection>
		</div>

		<UmMetricSection
			umData={view.umData}
			umCandidates={view.umCandidates}
			umFlagCount={view.flagCount}
			hasUmCandidates={view.hasUmCandidates}
			mediaNoun="movie"
			onselect={(c) => view.selectUm(c)}
		/>

		<DddMetricSection ddd={view.ddd} visibleTags={view.visibleTags} mediaNoun="movie" />

		<CastAndCrew media={movie} />

		<CollapsibleSection title="Details">
			<FactGrid {movie} />
		</CollapsibleSection>
	</div>
</article>

<style lang="postcss">
	@reference "../../../app.css";

	.title-page {
		@apply flex flex-col;
		gap: var(--spacing-xl);
		padding-top: var(--spacing-lg);
	}

	.sections {
		@apply flex flex-col;
	}

	.no-data {
		@apply text-ink-muted;
	}

	.meta-note {
		@apply text-sm text-ink-muted;
	}

	/* Shared marker pattern: see .CLAUDE/architecture.md. Brand, not green/red: pass or fail
	   already reads from the rating in the heading row. */
	.bechdel-criteria {
		@apply flex flex-col list-none m-0 p-0;
	}

	.criterion {
		@apply flex items-center gap-sm text-sm text-ink-muted;
		padding-block: var(--spacing-xs);
	}

	.criterion--met {
		@apply text-ink font-medium;
	}

	.criterion-marker {
		@apply flex items-center justify-center rounded-full text-xs shrink-0;
		width: 1.375rem;
		height: 1.375rem;
		color: var(--ink-muted);
		box-shadow: inset 0 0 0 1px var(--border);
	}

	.criterion--met .criterion-marker {
		background-color: color-mix(in oklab, var(--brand) 14%, transparent);
		color: var(--brand);
		box-shadow: none;
	}
</style>
