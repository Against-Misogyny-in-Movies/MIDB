<script lang="ts">
	import type { PageData } from './$types';
	import DetailHeader from '$lib/components/movies/facts/detailHeader.svelte';
	import FactGrid from '$lib/components/movies/facts/factGrid.svelte';
	import MetricChip from '$lib/components/movies/facts/metricChip.svelte';
	import GenderDistribution from '$lib/components/movies/facts/genderDistribution.svelte';
	import CastRepresentation from '$lib/components/movies/facts/castRepresentation.svelte';
	import CrewRepresentation from '$lib/components/movies/facts/crewRepresentation.svelte';
	import RepresentationDisclosure from '$lib/components/movies/facts/representationDisclosure.svelte';
	import CollapsibleSection from '$lib/components/movies/sections/collapsibleSection.svelte';
	import CommentsSkeleton from '$lib/components/movies/sections/commentsSkeleton.svelte';
	import UmMetricSection from '$lib/components/movies/metrics/umMetricSection.svelte';
	import DddMetricSection from '$lib/components/movies/metrics/dddMetricSection.svelte';
	import VerdictPanel from '$lib/components/movies/facts/verdictPanel.svelte';
	import BackToTop from '$lib/components/ui/visualization/backToTop.svelte';
	import { BECHDEL_TIERS, umFlagCount } from '$lib/media/utils/metrics';

	const BECHDEL_CRITERIA = BECHDEL_TIERS.slice(0, 3);
	import { scoreSafety, scoreRepresentation } from '$lib/media/utils/verdict';
	import { createDddState } from '$lib/media/utils/dddStream.svelte.js';
	import type { UmCandidate } from '$lib/media/utils/metrics';

	let { data }: { data: PageData } = $props();
	const movie = $derived(data.movie);
	const bechdel = $derived(data.bechdel);
	const unconsenting = $derived(data.unconsenting);
	const umCandidates = $derived(data.umCandidates ?? []);

	let selectedUm = $state<UmCandidate | null>(null);
	$effect(() => {
		movie.id; // track
		selectedUm = null;
	});

	const autoUm = $derived(umCandidates.length === 1 ? umCandidates[0] : null);
	const umData = $derived(unconsenting ?? autoUm ?? selectedUm);
	const hasUmCandidates = $derived(umData === null && umCandidates.length > 1);
	const flagCount = $derived(umFlagCount(umData));

	const dddState = createDddState(() => data.triggerTags, false);
	const ddd = $derived(dddState.current);

	const safety = $derived(scoreSafety(umData, ddd));
	const representation = $derived(
		scoreRepresentation({
			cast: movie.cast,
			crew: movie.crew,
			castMembers: movie.castMembers,
			crewDepartments: movie.crewDepartments,
			bechdel,
			isSeries: false
		})
	);
</script>

<div class="movie-page">
	<section id="details">
		<DetailHeader media={movie}>
			{#snippet verdict()}
				<VerdictPanel {safety} {representation} />
			{/snippet}
			<div class="summary-chips">
				<MetricChip
					href="#bechdel"
					icon="ri-scales-3-line"
					label="Bechdel Test"
					empty={bechdel === null}
				>
					{#if bechdel}
						<span class="chip-value">{bechdel.rating}<span class="chip-unit">/3</span></span>
					{:else}
						<span class="chip-empty">No data</span>
					{/if}
				</MetricChip>

				<MetricChip
					href="#unconsenting"
					icon="ri-shield-cross-line"
					label="Unconsenting Media"
					empty={umData === null}
					badgeCount={hasUmCandidates ? umCandidates.length : 0}
				>
					{#if umData}
						<span class="chip-value"
							>{flagCount}<span class="chip-unit"> concern{flagCount === 1 ? '' : 's'}</span></span
						>
					{:else}
						<span class="chip-empty">No data</span>
					{/if}
				</MetricChip>

				<MetricChip
					href="#ddd"
					icon="ri-alarm-warning-line"
					label="Does the Dog Die"
					empty={ddd !== null && ddd.tags.length === 0}
				>
					{#if ddd === null}
						<span class="chip-loading" aria-busy="true">Loading…</span>
					{:else if ddd.tags.length > 0}
						<span class="chip-value"
							>{ddd.tags.length}<span class="chip-unit">
								tag{ddd.tags.length === 1 ? '' : 's'}</span
							></span
						>
					{:else}
						<span class="chip-empty">No data</span>
					{/if}
				</MetricChip>
			</div>

			<div class="facts-wrap">
				<FactGrid {movie} />
			</div>
		</DetailHeader>
	</section>

	<section id="gender" class="gender-section">
		<p class="label">Cast &amp; crew representation</p>

		<div class="rep-group">
			<h3 class="group-label label">Cast</h3>
			<GenderDistribution label="Cast" breakdown={movie.cast} />
			{#if movie.castMembers.length > 0}
				<RepresentationDisclosure label="cast by billing order">
					<CastRepresentation castMembers={movie.castMembers} />
				</RepresentationDisclosure>
			{/if}
		</div>

		<div class="rep-group">
			<h3 class="group-label label">Crew</h3>
			<GenderDistribution label="Crew" breakdown={movie.crew} />
			{#if movie.crewDepartments.length > 0}
				<RepresentationDisclosure label="crew by role">
					<CrewRepresentation crewDepartments={movie.crewDepartments} />
				</RepresentationDisclosure>
			{/if}
		</div>
	</section>

	<div class="metrics-stack">
		<div id="bechdel">
			<CollapsibleSection
				title="Bechdel Test"
				status={bechdel ? `Rating ${bechdel.rating}/3` : 'No data'}
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
									{#if met}<i class="ri-check-line"></i>{:else}<i class="ri-close-line"></i>{/if}
								</span>
								<span class="criterion-label">{criterion.label}</span>
							</li>
						{/each}
					</ol>
					<p class="meta-note">Based on {bechdel.numVotes.toLocaleString()} votes</p>
				{:else}
					<p class="no-data">This movie is not in the Bechdel Test database.</p>
				{/if}
			</CollapsibleSection>
		</div>

		<UmMetricSection
			{umData}
			{umCandidates}
			umFlagCount={flagCount}
			{hasUmCandidates}
			mediaNoun="movie"
			onselect={(c) => (selectedUm = c)}
		/>

		<DddMetricSection {ddd} visibleTags={ddd?.tags ?? []} mediaNoun="movie" />
	</div>

	<CommentsSkeleton />

	<BackToTop />
</div>

<style lang="postcss">
	@reference "../../../app.css";

	.movie-page {
		@apply flex flex-col py-xl;
		gap: var(--spacing-xl);
	}

	#details {
		@apply flex flex-col gap-lg;
	}

	.gender-section {
		@apply flex flex-col gap-lg;
	}

	.rep-group {
		@apply flex flex-col gap-sm;
	}

	.group-label {
		@apply text-ink-muted mb-xs;
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

	.meta-note {
		@apply text-xs text-ink-muted;
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

	.bechdel-criteria {
		@apply flex flex-col list-none m-0 p-0;
	}

	.criterion {
		@apply relative flex items-center gap-sm text-sm text-ink-muted;
		padding-block: var(--spacing-xs);
	}

	.criterion:not(:last-child)::before {
		content: '';
		@apply absolute;
		left: 0.6875rem; /* centre of the 1.375rem marker */
		top: calc(50% + 0.6875rem);
		bottom: calc(50% - 0.6875rem - var(--spacing-xs) * 2);
		width: 2px;
		background-color: var(--border);
	}

	.criterion--met:not(:last-child)::before {
		background-color: color-mix(in oklab, var(--success) 45%, var(--border));
	}

	.criterion--met {
		@apply text-ink font-medium;
	}

	.criterion-marker {
		@apply flex items-center justify-center rounded-full text-xs font-semibold shrink-0 z-10;
		width: 1.375rem;
		height: 1.375rem;
		background-color: var(--secondary-soft);
		color: var(--ink-muted);
	}

	.criterion--met .criterion-marker {
		background-color: color-mix(in oklab, var(--success) 16%, transparent);
		color: var(--success);
	}

	.criterion-label {
		@apply leading-snug;
	}
</style>
