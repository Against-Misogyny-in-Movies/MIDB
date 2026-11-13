<script lang="ts">
	import { onMount, untrack } from 'svelte';
	import CollapsibleSection from '#lib/components/movies/sections/collapsibleSection.svelte';
	import Notice from '#lib/components/ui/notice.svelte';
	import ReaderReportCounts from './readerReportCounts.svelte';
	import ReaderReportFlag from './readerReportFlag.svelte';
	import ReaderReportOwn from './readerReportOwn.svelte';
	import { READER_REPORT_MIN } from '#lib/media/utils/readerReports.ts';
	import { ReaderReportsState } from '#lib/media/utils/readerReportsState.svelte.js';
	import { session } from '#lib/media/utils/session.svelte.js';
	import { titleHref } from '#lib/media/utils/titleHref.ts';

	interface Props {
		kind: 'movie' | 'tv';
		tmdbId: string;
		/** Tests give the section a fetcher; the pages use the browser's. */
		fetcher?: (input: string, init?: RequestInit) => Promise<Response>;
	}

	let { kind, tmdbId, fetcher }: Props = $props();

	// One section per title: the pages key it on the TMDB id, so these never change.
	// svelte-ignore state_referenced_locally
	const reports = new ReaderReportsState(kind, tmdbId, fetcher);

	// The section opens for a link to it (`#reader-reports`, which the sign-in return path carries).
	// It is read on mount only: the server render never knows the hash, and the section is below the
	// fold, so opening it moves nothing the reader sees.
	let open = $state(false);

	onMount(() => {
		open = location.hash === '#reader-reports';
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
		`/auth?next=${encodeURIComponent(`${titleHref(kind, Number(tmdbId)) ?? '/'}#reader-reports`)}`
	);

	const total = $derived(reports.counts?.total ?? 0);
	const counts = $derived(reports.counts && 'categories' in reports.counts ? reports.counts : null);
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
	id="reader-reports"
	title="Reader reports"
	icon="ri-survey-fill"
	hue="var(--brand)"
	{status}
	tone="neutral"
	busy={reports.phase === 'loading'}
	{open}
	learnHref="/resources#reader-reports"
>
	<div class="reports">
		<div class="slot" data-report-counts aria-busy={reports.phase === 'loading'}>
			{#if reports.phase === 'error'}
				<Notice tone="error">{reports.errors.load}</Notice>
				<button class="btn btn--ink retry" type="button" onclick={() => reports.load()}>
					Try again
				</button>
			{:else if reports.phase === 'loading'}
				<div class="skeleton" aria-label="Loading reader reports">
					{#each { length: 6 } as _, i (i)}
						<div class="skeleton-row"></div>
					{/each}
				</div>
			{:else if counts}
				<ReaderReportCounts {counts} />
			{:else}
				<p class="below">
					{total === 0
						? 'No counted reader reports yet.'
						: `${total} counted so far. Counts show once ${READER_REPORT_MIN} are counted.`}
				</p>
			{/if}
		</div>

		<ReaderReportOwn state={reports} {signInHref} />

		{#if canFlag}
			<ReaderReportFlag state={reports} />
		{/if}
	</div>
</CollapsibleSection>

<style lang="postcss">
	@reference "../../../../app.css";

	/*
	 * The counts' full height: five category rows and the framing row, each a name line and a
	 * figures line on phones and one line from 40rem (readerReportCounts.svelte, `.line`: two or one
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
