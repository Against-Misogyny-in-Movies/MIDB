<script lang="ts">
	import type { PageData } from './$types';
	import DetailHeader from '#lib/components/movies/facts/detailHeader.svelte';
	import SeriesFactGrid from '#lib/components/movies/facts/seriesFactGrid.svelte';
	import SourceIndex from '#lib/components/movies/facts/sourceIndex.svelte';
	import VerdictPanel from '#lib/components/movies/facts/verdictPanel.svelte';
	import CastAndCrew from '#lib/components/movies/facts/castAndCrew.svelte';
	import CommentsSection from '#lib/components/comments/commentsSection.svelte';
	import CollapsibleSection from '#lib/components/movies/sections/collapsibleSection.svelte';
	import DddEpisodeSelector from '#lib/components/movies/metrics/dddEpisodeSelector.svelte';
	import CommunityReportsBadge from '#lib/components/movies/metrics/communityReportsBadge.svelte';
	import CommunityReportsSection from '#lib/components/movies/metrics/communityReportsSection.svelte';
	import UmMetricSection from '#lib/components/movies/metrics/umMetricSection.svelte';
	import DddMetricSection from '#lib/components/movies/metrics/dddMetricSection.svelte';
	import { CommunityReportsState } from '#lib/media/utils/communityReportsState.svelte.js';
	import { TitleView } from '#lib/media/utils/titleView.svelte.js';

	let { data }: { data: PageData } = $props();
	const view = new TitleView(() => data, 'tv');
	const episodes = view.episodes!;
	const series = $derived(view.media);
	// One state per title, recreated when the TMDB id changes; the header badge and the section share it.
	const reports = $derived(new CommunityReportsState('tv', series.tmdbId));
	const ddd = $derived(view.ddd);
</script>

<svelte:head>
	<title>{series.title} · MIDB</title>
</svelte:head>

<article class="title-page">
	<DetailHeader media={series}>
		{#snippet aside()}
			<CommunityReportsBadge {reports} />
		{/snippet}
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
			updatedAt={data.syncedAt.um}
			onselect={(c) => view.selectUm(c)}
		/>

		{#key series.tmdbId}
			<CommunityReportsSection kind="tv" tmdbId={series.tmdbId} {reports} />
		{/key}

		<DddMetricSection {ddd} visibleTags={view.visibleTags}>
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

		<CollapsibleSection title="Details" icon="ri-tv-2-fill" hue="var(--src-tmdb)">
			<SeriesFactGrid {series} />
		</CollapsibleSection>

		{#key series.tmdbId}
			<CommentsSection kind="tv" tmdbId={series.tmdbId} />
		{/key}
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
		gap: 16px;
	}
</style>
