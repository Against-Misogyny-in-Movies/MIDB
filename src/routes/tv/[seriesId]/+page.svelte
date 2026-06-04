<script lang="ts">
	import type { PageData } from './$types';
	import DetailHeader from '$lib/components/movies/detailHeader.svelte';
	import SeriesFactGrid from '$lib/components/movies/seriesFactGrid.svelte';
	import GenderDistribution from '$lib/components/movies/genderDistribution.svelte';
	import CollapsibleSection from '$lib/components/movies/collapsibleSection.svelte';
	import DddTags from '$lib/components/movies/dddTags.svelte';
	import DddEpisodeSelector from '$lib/components/movies/dddEpisodeSelector.svelte';
	import UmCandidates from '$lib/components/movies/umCandidates.svelte';
	import { UM_FLAGS, type UmCandidate } from '$lib/movie/metrics';

	let { data }: { data: PageData } = $props();
	const series = $derived(data.series);
	const unconsenting = $derived(data.unconsenting);
	const umCandidates = $derived(data.umCandidates ?? []);

	// The candidate the user picked for this page view only. Never persisted —
	// reset whenever the series changes so a stale pick can't leak across titles.
	let selectedUm = $state<UmCandidate | null>(null);
	let selectedSeason = $state<number | null>(null);
	let selectedEpisode = $state<number | null>(null);
	$effect(() => {
		series.id; // track
		selectedUm = null;
		selectedSeason = null;
		selectedEpisode = null;
	});

	// A lone candidate is an exact year match (the server only returns one when
	// the series's year pins it), so render it directly — no picker needed.
	const autoUm = $derived(umCandidates.length === 1 ? umCandidates[0] : null);

	// Unified UM source: a seeded binding, else a year-pinned auto-match, else the
	// user's current-page pick.
	const umData = $derived(unconsenting ?? autoUm ?? selectedUm);
	const hasUmCandidates = $derived(umData === null && umCandidates.length > 1);

	// Resolve the streamed promise into reactive state once it settles.
	type DddResult = import('../../movie/[movieId]/ddd.server.js').DddResult;
	let ddd = $state<DddResult | null>(null);
	$effect(() => {
		let cancelled = false;
		ddd = null;
		data.triggerTags
			.catch((): DddResult => ({ itemId: null, tags: [], isSeries: true }))
			.then((result) => {
				if (!cancelled) ddd = result;
			});
		return () => {
			cancelled = true;
		};
	});

	function dddUrl(itemId: number | null) {
		return itemId
			? `https://www.doesthedogdie.com/media/${itemId}`
			: 'https://www.doesthedogdie.com';
	}

	// `noRape` is inverted: true means "no rape/assault" — a reassurance, not a concern.
	const umFlagCount = $derived(
		umData ? UM_FLAGS.filter((f) => f.key !== 'noRape' && umData[f.key] === true).length : 0
	);

	// Client-side filtering by season/episode — no refetch, one Array.filter over in-memory list.
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
			<!-- Metrics summary chips -->
			<div class="summary-chips">
				<!-- Bechdel chip — N/A for series -->
				<div class="chip chip--empty" aria-label="Bechdel Test — not applicable to series">
					<span class="chip-icon" aria-hidden="true"><i class="ri-scales-3-line"></i></span>
					<span class="chip-text">
						<span class="chip-label">Bechdel Test</span>
						<span class="chip-empty">N/A</span>
					</span>
				</div>

				<!-- UM chip -->
				<div class="chip-wrap">
					<a class="chip" href="#unconsenting" class:chip--empty={umData === null}>
						<span class="chip-icon" aria-hidden="true"><i class="ri-shield-cross-line"></i></span>
						<span class="chip-text">
							<span class="chip-label">Unconsenting Media</span>
							{#if umData}
								<span class="chip-value"
									>{umFlagCount}<span class="chip-unit">
										concern{umFlagCount === 1 ? '' : 's'}</span
									></span
								>
							{:else}
								<span class="chip-empty">No data</span>
							{/if}
						</span>
					</a>
					{#if hasUmCandidates}
						<span
							class="chip-badge"
							aria-label="{umCandidates.length} possible Unconsenting Media match{umCandidates.length ===
							1
								? ''
								: 'es'} — choose below"
						>
							<i class="ri-error-warning-line" aria-hidden="true"></i>
						</span>
					{/if}
				</div>

				<!-- DDD chip (streamed) -->
				<a class="chip" href="#ddd" class:chip--empty={ddd !== null && visibleTags.length === 0}>
					<span class="chip-icon" aria-hidden="true"><i class="ri-alarm-warning-line"></i></span>
					<span class="chip-text">
						<span class="chip-label">Does the Dog Die</span>
						{#if ddd === null}
							<span class="chip-loading" aria-busy="true">Loading…</span>
						{:else if visibleTags.length > 0}
							<span class="chip-value"
								>{visibleTags.length}<span class="chip-unit">
									tag{visibleTags.length === 1 ? '' : 's'}</span
								></span
							>
						{:else}
							<span class="chip-empty">No data</span>
						{/if}
					</span>
				</a>
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
		<!-- Bechdel section — N/A for series -->
		<div id="bechdel">
			<CollapsibleSection title="Bechdel Test" status="Not applicable" tone="empty" open={false}>
				<p class="no-data">The Bechdel Test rates films, not series.</p>
			</CollapsibleSection>
		</div>

		<!-- Unconsenting Media section -->
		<div id="unconsenting">
			<CollapsibleSection
				title="Unconsenting Media"
				status={umData ? `${umFlagCount} concern${umFlagCount === 1 ? '' : 's'}` : 'No data'}
				tone={umData ? 'data' : 'empty'}
				open={umData !== null || hasUmCandidates}
				sourceLabel={umData ? 'UnconsentingMedia.org' : undefined}
				sourceHref={umData ? `https://www.unconsentingmedia.org/items/${umData.umId}` : undefined}
			>
				{#if umData}
					<ul class="um-flags">
						{#each UM_FLAGS as flag (flag.key)}
							{@const value = umData[flag.key] === true}
							{@const reassurance = flag.key === 'noRape' && value}
							{@const present = value && !reassurance}
							<li
								class="um-flag"
								class:um-flag--present={present}
								class:um-flag--reassurance={reassurance}
							>
								<span class="flag-check" aria-hidden="true">
									<i
										class={reassurance
											? 'ri-checkbox-circle-fill'
											: present
												? 'ri-alert-fill'
												: 'ri-checkbox-blank-circle-line'}
									></i>
								</span>
								<span>{flag.label}</span>
							</li>
						{/each}
					</ul>
					{#if umData.comment}
						<p class="um-comment">{umData.comment}</p>
					{/if}
				{:else if hasUmCandidates}
					<UmCandidates candidates={umCandidates} onselect={(c) => (selectedUm = c)} />
				{:else}
					<p class="no-data">This series is not in the Unconsenting Media database.</p>
				{/if}
			</CollapsibleSection>
		</div>

		<!-- Does the Dog Die section -->
		<div id="ddd">
			<CollapsibleSection
				title="Does the Dog Die"
				status={ddd === null
					? 'Loading…'
					: visibleTags.length > 0
						? `${visibleTags.length} trigger tag${visibleTags.length === 1 ? '' : 's'}`
						: 'No data'}
				tone={ddd === null ? 'loading' : visibleTags.length > 0 ? 'data' : 'empty'}
				open={ddd === null || visibleTags.length > 0}
				sourceLabel="DoesTheDogDie.com"
				sourceHref={dddUrl(ddd?.itemId ?? null)}
			>
				{#if ddd === null}
					<div class="ddd-skeleton" aria-busy="true">
						<div class="skeleton-tag"></div>
						<div class="skeleton-tag"></div>
						<div class="skeleton-tag"></div>
					</div>
				{:else}
					{#if ddd.isSeries && series.seasons.length > 0}
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
					{#if visibleTags.length > 0}
						<DddTags tags={visibleTags} />
					{:else}
						<p class="no-data">No trigger tags found for this series.</p>
					{/if}
				{/if}
			</CollapsibleSection>
		</div>
	</div>

	<!-- Comments section -->
	<section id="comments" class="comments-section">
		<h2 class="comments-heading display">Comments</h2>
		<div class="comments-list" aria-busy="true" aria-label="Loading comments">
			{#each { length: 4 } as _, i (i)}
				<div class="comment-skeleton">
					<div class="comment-skeleton__avatar"></div>
					<div class="comment-skeleton__body">
						<div class="comment-skeleton__meta">
							<div class="comment-skeleton__name"></div>
							<div class="comment-skeleton__date"></div>
						</div>
						<div class="comment-skeleton__line"></div>
						<div class="comment-skeleton__line comment-skeleton__line--short"></div>
					</div>
				</div>
			{/each}
		</div>
	</section>
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

	/* ── Summary chips ── */
	.summary-chips {
		@apply grid gap-sm mt-xs;
		grid-template-columns: repeat(auto-fit, minmax(13rem, 1fr));
	}

	.chip {
		@apply relative flex items-center gap-sm px-md py-sm rounded-lg border border-border no-underline overflow-hidden;
		min-height: 4.5rem;
		background-image: linear-gradient(
			135deg,
			color-mix(in oklab, var(--brand) 8%, var(--surface-raised)),
			var(--surface-raised)
		);
		transition:
			border-color 0.15s ease,
			box-shadow 0.15s ease,
			transform 0.15s ease;
	}

	a.chip:hover {
		border-color: var(--brand);
		transform: translateY(-2px);
		box-shadow: 0 6px 18px -8px color-mix(in oklab, var(--brand) 55%, transparent);
	}

	a.chip:focus-visible {
		@apply outline-none;
		box-shadow: 0 0 0 2px var(--brand);
	}

	.chip-icon {
		@apply flex items-center justify-center w-9 h-9 rounded-full shrink-0 text-lg;
		background-color: color-mix(in oklab, var(--brand) 14%, transparent);
		color: var(--brand);
	}

	.chip-text {
		@apply flex flex-col gap-0 min-w-0;
	}

	.chip-label {
		@apply text-xs tracking-wide uppercase text-ink-muted truncate;
		font-variant-caps: all-small-caps;
	}

	.chip-value {
		@apply text-2xl font-semibold text-brand leading-tight;
		font-family: var(--font-display);
	}

	.chip-unit {
		@apply text-sm font-normal text-ink-muted ml-1;
	}

	.chip-empty,
	.chip-loading {
		@apply text-sm text-ink-muted italic leading-tight;
	}

	.chip--empty {
		background-image: none;
		background-color: var(--surface-raised);
	}

	.chip--empty .chip-icon {
		background-color: var(--secondary-soft);
		color: var(--ink-muted);
	}

	.chip-wrap {
		@apply relative;
	}

	.chip-badge {
		@apply absolute -top-3 -right-3 flex items-center justify-center w-7 h-7 rounded-full text-base z-10;
		background-color: var(--accent-bg);
		color: var(--accent-ink);
		box-shadow: 0 0 0 2px var(--surface-raised);
	}

	.chip-badge::after {
		content: '';
		@apply absolute inset-0 rounded-full;
		background-color: var(--accent-bg);
		opacity: 0.5;
		animation: badge-pulse 2s ease infinite;
	}

	@keyframes badge-pulse {
		0%,
		100% {
			transform: scale(1);
			opacity: 0.5;
		}
		50% {
			transform: scale(2);
			opacity: 0;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.chip-badge::after {
			animation: none;
		}
	}

	/* ── UM flags ── */
	.um-flags {
		@apply grid gap-xs list-none m-0 p-0;
		grid-template-columns: repeat(auto-fill, minmax(15rem, 1fr));
	}

	.um-flag {
		@apply flex items-center gap-sm text-sm text-ink-muted;
	}

	.um-flag--present {
		@apply text-ink font-medium;
	}

	.um-flag--reassurance {
		@apply text-ink font-medium;
	}

	.flag-check {
		@apply flex items-center justify-center w-5 h-5 shrink-0 text-ink-muted opacity-40;
	}

	.um-flag--present .flag-check {
		@apply opacity-100;
		color: var(--warn);
	}

	.um-flag--reassurance .flag-check {
		@apply opacity-100;
		color: var(--success);
	}

	.um-comment {
		@apply text-sm text-ink-muted mt-xs leading-relaxed border-l-2 pl-md;
		border-color: var(--border);
		white-space: pre-wrap;
	}

	/* ── DDD trigger tags ── */
	.ddd-skeleton {
		@apply flex flex-col gap-sm;
	}

	.skeleton-tag {
		@apply h-9 w-full rounded-md bg-surface animate-pulse;
	}

	/* ── Comments section ── */
	.comments-section {
		@apply flex flex-col gap-lg;
	}

	.comments-heading {
		@apply text-xl font-semibold text-ink;
	}

	.comments-list {
		@apply flex flex-col gap-md;
	}

	.comment-skeleton {
		@apply flex gap-md;
	}

	.comment-skeleton__avatar {
		@apply w-10 h-10 rounded-full shrink-0 animate-pulse;
		background-color: var(--surface-raised);
	}

	.comment-skeleton__body {
		@apply flex flex-col gap-xs flex-1 min-w-0;
	}

	.comment-skeleton__meta {
		@apply flex items-center gap-sm;
	}

	.comment-skeleton__name {
		@apply h-3 w-24 rounded animate-pulse;
		background-color: var(--surface-raised);
	}

	.comment-skeleton__date {
		@apply h-3 w-16 rounded animate-pulse;
		background-color: var(--surface-raised);
		animation-delay: 80ms;
	}

	.comment-skeleton__line {
		@apply h-3 w-full rounded animate-pulse;
		background-color: var(--surface-raised);
		animation-delay: 120ms;
	}

	.comment-skeleton__line--short {
		@apply w-3/5;
		animation-delay: 160ms;
	}
</style>
