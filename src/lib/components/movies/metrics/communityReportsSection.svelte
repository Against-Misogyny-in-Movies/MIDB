<script lang="ts">
	import { onMount, untrack } from 'svelte';
	import CollapsibleSection from '#lib/components/movies/sections/collapsibleSection.svelte';
	import Notice from '#lib/components/ui/notice.svelte';
	import CommunityReportCounts from './communityReportCounts.svelte';
	import CommunityReportFlag from './communityReportFlag.svelte';
	import CommunityReportOwn from './communityReportOwn.svelte';
	import { COMMUNITY_REPORT_MIN } from '#lib/media/utils/communityReports.ts';
	import type { CommunityReportsState } from '#lib/media/utils/communityReportsState.svelte.js';
	import { session } from '#lib/media/utils/session.svelte.js';
	import { titleHref } from '#lib/media/utils/titleHref.ts';

	interface Props {
		kind: 'movie' | 'tv';
		tmdbId: string;
		/** The title's reports, owned by the page so the header badge reads the same counts. */
		reports: CommunityReportsState;
	}

	let { kind, tmdbId, reports }: Props = $props();

	onMount(() => {
		// The page is cached for everyone, so the reader's own report comes from the private
		// endpoint once the session says who is reading.
		void session.load();
		void reports.load();
		if (session.likelyUser) void reports.loadViewer();
	});

	$effect(() => {
		if (session.status === 'user') {
			if (untrack(() => reports.viewerPhase) === 'idle') void untrack(() => reports.loadViewer());
		} else if (session.status === 'anon') {
			untrack(() => reports.clearViewer());
		}
	});

	const signInHref = $derived(
		`/auth?next=${encodeURIComponent(`${titleHref(kind, Number(tmdbId)) ?? '/'}#community-reports`)}`
	);

	const total = $derived(reports.counts?.total ?? 0);
	const counts = $derived(reports.counts && 'categories' in reports.counts ? reports.counts : null);
	/**
	 * Whether the report form is open: the "Counts look wrong" link waits, but the flag component
	 * stays mounted so a note already typed in its plate survives.
	 */
	let editing = $state(false);
	const status = $derived(
		reports.phase === 'loading'
			? 'Loading'
			: reports.phase === 'error'
				? 'Unavailable'
				: `${total} counted`
	);
	const canFlag = $derived(
		counts !== null &&
			session.status === 'user' &&
			reports.viewerPhase === 'ready' &&
			!reports.viewer?.mutedUntil
	);
</script>

<CollapsibleSection
	id="community-reports"
	title="MIDB community reports"
	icon="ri-survey-fill"
	hue="var(--brand)"
	{status}
	tone="neutral"
	busy={reports.phase === 'loading'}
	open={false}
	openOnHash
	learnHref="/resources#community-reports"
>
	<div class="reports">
		<div class="slot" data-report-counts aria-busy={reports.phase === 'loading'}>
			{#if reports.phase === 'error'}
				<Notice tone="error">{reports.errors.load}</Notice>
				<button class="btn btn--ink retry" type="button" onclick={() => reports.load()}>
					Try again
				</button>
			{:else if reports.phase === 'loading'}
				<div class="skeleton" role="status">
					<span class="sr-only">Loading community reports</span>
					{#each { length: 6 } as _, i (i)}
						<div class="skeleton-row"></div>
					{/each}
				</div>
			{:else if counts}
				<CommunityReportCounts {counts} />
			{:else}
				<p class="below">
					{total === 0
						? 'No counted community reports yet.'
						: `${total} counted so far. Counts show once ${COMMUNITY_REPORT_MIN} are counted.`}
				</p>
			{/if}
		</div>

		<CommunityReportOwn state={reports} {signInHref} bind:editing />

		{#if canFlag}
			<CommunityReportFlag state={reports} hideTrigger={editing} />
		{/if}
	</div>
</CollapsibleSection>

<style lang="postcss">
	@reference "../../../../app.css";

	/*
	 * The counts' full height: five category rows and the framing row, each a name line and a
	 * figures line on phones and one line from 40rem (communityReportCounts.svelte, `.line`: two or one
	 * 1.25rem text lines, 2px apart, in 0.5rem of padding above and below), with a 1px hairline
	 * between rows. The skeleton draws those rows and every shorter state sits at the top of the
	 * same height, so nothing below the slot moves when the counts arrive.
	 */
	.reports {
		@apply flex flex-col;
		gap: var(--spacing-md);
		--report-row: 3.625rem;
	}

	@media (min-width: 40rem) {
		.reports {
			--report-row: 2.25rem;
		}
	}

	.slot {
		@apply flex flex-col;
		min-height: calc(6 * var(--report-row) + 5px);
		gap: var(--spacing-sm);
	}

	.below {
		@apply text-ink-muted;
	}

	.retry {
		@apply self-start;
	}

	.skeleton {
		@apply flex flex-col;
	}

	.skeleton-row {
		@apply flex items-center;
		height: var(--report-row);
		animation: pulse 1.6s ease-in-out infinite;
	}

	.skeleton-row + .skeleton-row {
		border-top: 1px solid var(--border);
		height: calc(var(--report-row) + 1px);
	}

	.skeleton-row::before {
		content: '';
		width: 40%;
		height: 0.75rem;
		background-color: var(--surface-sunken);
	}

	@keyframes pulse {
		50% {
			opacity: 0.5;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.skeleton-row {
			animation: none;
		}
	}
</style>
