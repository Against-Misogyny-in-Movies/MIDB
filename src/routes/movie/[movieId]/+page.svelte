<script lang="ts">
	import type { PageData } from './$types';
	import DetailHeader from '$lib/components/movies/detailHeader.svelte';
	import FactGrid from '$lib/components/movies/factGrid.svelte';
	import GenderDistribution from '$lib/components/movies/genderDistribution.svelte';
	import CollapsibleSection from '$lib/components/movies/collapsibleSection.svelte';
	import DddTags from '$lib/components/movies/dddTags.svelte';
	import UmCandidates from '$lib/components/movies/umCandidates.svelte';
	import { BECHDEL_TIERS, UM_FLAGS, type UmCandidate } from '$lib/movie/metrics';

	let { data }: { data: PageData } = $props();
	const movie = $derived(data.movie);
	const bechdel = $derived(data.bechdel);
	const unconsenting = $derived(data.unconsenting);
	const umCandidates = $derived(data.umCandidates ?? []);

	// The candidate the user picked for this page view only. Never persisted —
	// reset whenever the movie changes so a stale pick can't leak across films.
	let selectedUm = $state<UmCandidate | null>(null);
	$effect(() => {
		movie.id; // track
		selectedUm = null;
	});

	// A lone candidate is an exact year match (the server only returns one when
	// the movie's year pins it), so render it directly — no picker needed.
	const autoUm = $derived(umCandidates.length === 1 ? umCandidates[0] : null);

	// Unified UM source: a seeded binding, else a year-pinned auto-match, else the
	// user's current-page pick. All expose the same UM flag keys + umId + comment,
	// so the section and chip render identically regardless of origin.
	const umData = $derived(unconsenting ?? autoUm ?? selectedUm);
	const hasUmCandidates = $derived(umData === null && umCandidates.length > 1);

	// Resolve the streamed promise into reactive state once it settles, so both the
	// chip and the section read the same settled value.
	type DddResult = import('./ddd.server.js').DddResult;
	let ddd = $state<DddResult | null>(null);
	$effect(() => {
		let cancelled = false;
		ddd = null;
		data.triggerTags
			.catch((): DddResult => ({ itemId: null, tags: [] }))
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

	// `noRape` is inverted: true means "no rape/assault" — a reassurance, not a
	// concern — so it never counts toward the concern tally.
	const umFlagCount = $derived(
		umData ? UM_FLAGS.filter((f) => f.key !== 'noRape' && umData[f.key] === true).length : 0
	);
</script>

<div class="movie-page">
	<section id="details">
		<DetailHeader {movie}>
			<!-- Metrics summary chips, in place of the plot overview -->
			<div class="summary-chips">
				<!-- Bechdel chip -->
				<a class="chip" href="#bechdel" class:chip--empty={bechdel === null}>
					<span class="chip-icon" aria-hidden="true"><i class="ri-scales-3-line"></i></span>
					<span class="chip-text">
						<span class="chip-label">Bechdel Test</span>
						{#if bechdel}
							<span class="chip-value">{bechdel.rating}<span class="chip-unit">/3</span></span>
						{:else}
							<span class="chip-empty">No data</span>
						{/if}
					</span>
				</a>

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
				<a class="chip" href="#ddd" class:chip--empty={ddd !== null && ddd.tags.length === 0}>
					<span class="chip-icon" aria-hidden="true"><i class="ri-alarm-warning-line"></i></span>
					<span class="chip-text">
						<span class="chip-label">Does the Dog Die</span>
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
					</span>
				</a>
			</div>

			<div class="facts-wrap">
				<FactGrid {movie} />
			</div>
		</DetailHeader>
	</section>

	<section id="gender" class="gender-section">
		<p class="label">Cast &amp; crew representation</p>
		<GenderDistribution cast={movie.cast} crew={movie.crew} />
	</section>

	<div class="metrics-stack">
		<!-- Bechdel section -->
		<div id="bechdel">
			<CollapsibleSection
				title="Bechdel Test"
				status={bechdel ? `Rating ${bechdel.rating}/3` : 'No data'}
				tone={bechdel ? 'data' : 'empty'}
				open={bechdel !== null}
				sourceLabel={bechdel ? 'BechdelTest.com' : undefined}
				sourceHref={bechdel ? `https://bechdeltest.com/view/${bechdel.bechdelId}` : undefined}
			>
				{#if bechdel}
					<ul class="bechdel-tiers">
						{#each BECHDEL_TIERS as tier (tier.level)}
							<li class="tier" class:tier--enabled={tier.level <= bechdel.rating}>
								<span class="tier-check" aria-hidden="true">
									<i class={tier.level <= bechdel.rating ? 'ri-check-line' : 'ri-close-line'}></i>
								</span>
								<span>{tier.label}</span>
							</li>
						{/each}
					</ul>
					<p class="meta-note">Based on {bechdel.numVotes.toLocaleString()} votes</p>
				{:else}
					<p class="no-data">This movie is not in the Bechdel Test database.</p>
				{/if}
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
					<p class="no-data">This movie is not in the Unconsenting Media database.</p>
				{/if}
			</CollapsibleSection>
		</div>

		<!-- Does the Dog Die section -->
		<div id="ddd">
			<CollapsibleSection
				title="Does the Dog Die"
				status={ddd === null
					? 'Loading…'
					: ddd.tags.length > 0
						? `${ddd.tags.length} trigger tag${ddd.tags.length === 1 ? '' : 's'}`
						: 'No data'}
				tone={ddd === null ? 'loading' : ddd.tags.length > 0 ? 'data' : 'empty'}
				open={ddd === null || ddd.tags.length > 0}
				sourceLabel="DoesTheDogDie.com"
				sourceHref={dddUrl(ddd?.itemId ?? null)}
			>
				{#if ddd === null}
					<div class="ddd-skeleton" aria-busy="true">
						<div class="skeleton-tag"></div>
						<div class="skeleton-tag"></div>
						<div class="skeleton-tag"></div>
					</div>
				{:else if ddd.tags.length > 0}
					<DddTags tags={ddd.tags} />
				{:else}
					<p class="no-data">No trigger tags found for this movie.</p>
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

	.movie-page {
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

	.meta-note {
		@apply text-xs text-ink-muted;
	}

	.facts-wrap {
		@apply border-t border-border pt-md mt-xs;
	}

	/* ── Summary chips (status indicators in the header) ── */
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

	.chip:hover {
		border-color: var(--brand);
		transform: translateY(-2px);
		box-shadow: 0 6px 18px -8px color-mix(in oklab, var(--brand) 55%, transparent);
	}

	.chip:focus-visible {
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

	/* Muted treatment when a metric has no data */
	.chip--empty {
		background-image: none;
		background-color: var(--surface-raised);
	}

	.chip--empty .chip-icon {
		background-color: var(--secondary-soft);
		color: var(--ink-muted);
	}

	/* Badge: candidate picker available */
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

	/* ── Bechdel tiers ── */
	.bechdel-tiers {
		@apply flex flex-col gap-xs list-none m-0 p-0;
	}

	.tier {
		@apply flex items-center gap-sm text-sm text-ink-muted;
	}

	.tier--enabled {
		@apply text-ink font-medium;
	}

	.tier-check {
		@apply flex items-center justify-center w-5 h-5 rounded-full text-xs shrink-0;
		background-color: var(--secondary-soft);
		color: var(--ink-muted);
	}

	.tier--enabled .tier-check {
		background-color: color-mix(in oklab, var(--success) 22%, transparent);
		color: var(--success);
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

	/* `noRape` = true is reassuring, not a concern: render it as a green tick. */
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
