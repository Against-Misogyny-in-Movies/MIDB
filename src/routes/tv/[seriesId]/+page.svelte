<script lang="ts">
	import type { PageData } from './$types';
	import DetailHeader from '$lib/components/movies/facts/detailHeader.svelte';
	import SeriesFactGrid from '$lib/components/movies/facts/seriesFactGrid.svelte';
	import SourceIndex from '$lib/components/movies/facts/sourceIndex.svelte';
	import VerdictPanel from '$lib/components/movies/facts/verdictPanel.svelte';
	import CastAndCrew from '$lib/components/movies/facts/castAndCrew.svelte';
	import CollapsibleSection from '$lib/components/movies/sections/collapsibleSection.svelte';
	import DddEpisodeSelector from '$lib/components/movies/metrics/dddEpisodeSelector.svelte';
	import UmMetricSection from '$lib/components/movies/metrics/umMetricSection.svelte';
	import DddMetricSection from '$lib/components/movies/metrics/dddMetricSection.svelte';
	import { TitleView } from '$lib/media/utils/titleView.svelte.js';

	let { data }: { data: PageData } = $props();
	const view = new TitleView(() => data, 'tv');
	const episodes = view.episodes!;
	const series = $derived(view.media);
	const ddd = $derived(view.ddd);
</script>

<article class="title-page">
	<DetailHeader media={series}>
		{#snippet verdict()}
			<VerdictPanel safety={view.safety} representation={view.representation} />
		{/snippet}
		<SourceIndex items={view.sources} />
	</DetailHeader>

	<div class="sections">
		<UmMetricSection
			umData={view.umData}
			umCandidates={view.umCandidates}
			umFlagCount={view.flagCount}
			hasUmCandidates={view.hasUmCandidates}
			mediaNoun="series"
			onselect={(c) => view.selectUm(c)}
		/>

		<DddMetricSection {ddd} visibleTags={view.visibleTags} mediaNoun="series">
			{#snippet selector()}
				{#if ddd?.isSeries && series.seasons.length > 0}
					<DddEpisodeSelector
						seasons={series.seasons}
						tags={ddd.tags}
						selectedSeason={episodes.season}
						selectedEpisode={episodes.episode}
						onchange={(season: number | null, episode: number | null) =>
							episodes.select(season, episode)}
					/>
				{/if}
			{/snippet}
		</DddMetricSection>

		<CastAndCrew media={series} />

		<CollapsibleSection title="Details">
			<SeriesFactGrid {series} />
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
</style>
