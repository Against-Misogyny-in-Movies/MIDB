<script lang="ts">
	import type { PageData } from './$types';
	import DetailHeader from '$lib/components/movies/facts/detailHeader.svelte';
	import SeriesFactGrid from '$lib/components/movies/facts/seriesFactGrid.svelte';
	import MetricChip from '$lib/components/movies/facts/metricChip.svelte';
	import GenderDistribution from '$lib/components/movies/facts/genderDistribution.svelte';
	import CollapsibleSection from '$lib/components/movies/sections/collapsibleSection.svelte';
	import CommentsSkeleton from '$lib/components/movies/sections/commentsSkeleton.svelte';
	import DddEpisodeSelector from '$lib/components/movies/metrics/dddEpisodeSelector.svelte';
	import UmMetricSection from '$lib/components/movies/metrics/umMetricSection.svelte';
	import DddMetricSection from '$lib/components/movies/metrics/dddMetricSection.svelte';
	import { umFlagCount } from '$lib/media/utils/metrics';
	import { createDddState } from '$lib/media/utils/dddStream.svelte.js';
	import type { UmCandidate } from '$lib/media/utils/metrics';

	let { data }: { data: PageData } = $props();
	const series = $derived(data.series);
	const unconsenting = $derived(data.unconsenting);
	const umCandidates = $derived(data.umCandidates ?? []);

	let selectedUm = $state<UmCandidate | null>(null);
	let selectedSeason = $state<number | null>(null);
	let selectedEpisode = $state<number | null>(null);
	$effect(() => {
		series.id; // track
		selectedUm = null;
		selectedSeason = null;
		selectedEpisode = null;
	});

	const autoUm = $derived(umCandidates.length === 1 ? umCandidates[0] : null);
	const umData = $derived(unconsenting ?? autoUm ?? selectedUm);
	const hasUmCandidates = $derived(umData === null && umCandidates.length > 1);
	const flagCount = $derived(umFlagCount(umData));

	const dddState = createDddState(() => data.triggerTags, true);
	const ddd = $derived(dddState.current);

	const visibleTags = $derived.by(() => {
		if (!ddd) return [];
		if (selectedSeason === null)
			return ddd.tags.filter((t) => t.season === -1 || t.season === null);
		if (selectedEpisode === null)
			return ddd.tags.filter((t) => t.season === selectedSeason || t.season === -1);
		return ddd.tags.filter(
			(t) => (t.season === selectedSeason && t.episode === selectedEpisode) || t.season === -1
		);
	});
</script>

<div class="series-page">
	<section id="details">
		<DetailHeader media={series}>
			<div class="summary-chips">
				<!-- Bechdel N/A for series — no href = renders as static div -->
				<MetricChip icon="ri-scales-3-line" label="Bechdel Test">
					<span class="chip-empty">N/A</span>
				</MetricChip>

				<MetricChip
					href="#unconsenting"
					icon="ri-shield-cross-line"
					label="Unconsenting Media"
					empty={umData === null}
					badgeCount={hasUmCandidates ? umCandidates.length : 0}
				>
					{#if umData}
						<span class="chip-value">{flagCount}<span class="chip-unit"> concern{flagCount === 1 ? '' : 's'}</span></span>
					{:else}
						<span class="chip-empty">No data</span>
					{/if}
				</MetricChip>

				<MetricChip
					href="#ddd"
					icon="ri-alarm-warning-line"
					label="Does the Dog Die"
					empty={ddd !== null && visibleTags.length === 0}
				>
					{#if ddd === null}
						<span class="chip-loading" aria-busy="true">Loading…</span>
					{:else if visibleTags.length > 0}
						<span class="chip-value">{visibleTags.length}<span class="chip-unit"> tag{visibleTags.length === 1 ? '' : 's'}</span></span>
					{:else}
						<span class="chip-empty">No data</span>
					{/if}
				</MetricChip>
			</div>

			<div class="facts-wrap">
				<SeriesFactGrid {series} />
			</div>
		</DetailHeader>
	</section>

	<section id="gender" class="gender-section">
		<p class="label">Cast &amp; crew representation</p>
		<GenderDistribution cast={series.cast} crew={series.crew} />
	</section>

	<div class="metrics-stack">
		<div id="bechdel">
			<CollapsibleSection title="Bechdel Test" status="Not applicable" tone="empty" open={false}>
				<p class="no-data">The Bechdel Test rates films, not series.</p>
			</CollapsibleSection>
		</div>

		<UmMetricSection
			{umData}
			{umCandidates}
			umFlagCount={flagCount}
			{hasUmCandidates}
			mediaNoun="series"
			onselect={(c) => (selectedUm = c)}
		/>

		<DddMetricSection {ddd} {visibleTags} mediaNoun="series">
			{#snippet selector()}
				{#if ddd?.isSeries && series.seasons.length > 0}
					<DddEpisodeSelector
						seasons={series.seasons}
						tags={ddd.tags}
						{selectedSeason}
						{selectedEpisode}
						onchange={(season: number | null, episode: number | null) => {
							selectedSeason = season;
							selectedEpisode = episode;
						}}
					/>
				{/if}
			{/snippet}
		</DddMetricSection>
	</div>

	<CommentsSkeleton />
</div>

<style lang="postcss">
	@reference "../../../app.css";

	.series-page {
		@apply flex flex-col py-xl;
		gap: var(--spacing-xl);
	}

	#details {
		@apply flex flex-col gap-lg;
	}

	.gender-section {
		@apply flex flex-col gap-md;
	}

	.metrics-stack {
		@apply flex flex-col gap-md;
		scroll-margin-top: var(--spacing-lg);
	}

	.metrics-stack > div {
		scroll-margin-top: var(--spacing-lg);
	}

	.no-data {
		@apply text-sm text-ink-muted italic;
	}

	.facts-wrap {
		@apply border-t border-border pt-md mt-xs;
	}

	.summary-chips {
		@apply grid gap-sm mt-xs;
		grid-template-columns: repeat(auto-fit, minmax(13rem, 1fr));
	}

	:global(.chip-value) {
		@apply text-2xl font-semibold text-brand leading-tight;
		font-family: var(--font-display);
	}

	:global(.chip-unit) {
		@apply text-sm font-normal text-ink-muted ml-1;
	}

	:global(.chip-empty),
	:global(.chip-loading) {
		@apply text-sm text-ink-muted italic leading-tight;
	}
</style>
