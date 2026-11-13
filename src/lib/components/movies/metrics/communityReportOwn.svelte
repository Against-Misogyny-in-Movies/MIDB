<script lang="ts">
	import Badge from '#lib/components/ui/badge.svelte';
	import Notice from '#lib/components/ui/notice.svelte';
	import CommunityReportForm from './communityReportForm.svelte';
	import type { CommunityReportsState } from '#lib/media/utils/communityReportsState.svelte.js';
	import { draftFromReport, emptyDraft, type ReportDraft } from '#lib/media/utils/reportDraft.ts';
	import { effectiveStanding, readerStandingLabel } from '#lib/media/utils/reportStanding.ts';
	import { focusAfterUpdate } from '#lib/media/utils/focus.ts';
	import { formatDate } from '#lib/media/utils/format.ts';
	import { session } from '#lib/media/utils/session.svelte.js';
	import { toasts } from '#lib/media/utils/toasts.svelte.js';
	import type { ContentReportStatus } from '#lib/media/utils/communityReports.ts';

	interface Props {
		state: CommunityReportsState;
		/** Where `/auth` sends the reader back to after signing in. */
		signInHref: string;
		/** Whether the form is open, so the section can hide the plates that would sit beside it. */
		editing?: boolean;
	}

	let { state: reports, signInHref, editing = $bindable(false) }: Props = $props();

	let draft = $state<ReportDraft>(emptyDraft());
	let trigger: HTMLButtonElement | undefined = $state();

	const report = $derived(reports.viewer?.report ?? null);
	const mutedUntil = $derived(reports.viewer?.mutedUntil ?? null);
	const standing = $derived(
		report
			? effectiveStanding({
					status: report.status,
					countsFrom: report.countsFrom,
					restricted: mutedUntil ? 'muted' : null
				})
			: null
	);
	const label = $derived(standing ? readerStandingLabel(standing) : null);
	/**
	 * A signed-in reader waits for their own report before the line shows, so a mute can replace
	 * it. A re-read after a save keeps the line: the report it read before is still on screen.
	 */
	const pending = $derived(
		reports.viewerPhase === 'idle' || (reports.viewerPhase === 'loading' && reports.viewer === null)
	);
	/**
	 * The line stays while the form is open, so the form sits under the row it acts on: a new report
	 * swaps "Add a report" for it, and an existing one drops only Edit.
	 */
	const showLine = $derived(report !== null || (editing && !mutedUntil));

	function show() {
		draft = report ? draftFromReport(report) : emptyDraft();
		editing = true;
		void focusAfterUpdate(() =>
			document.querySelector<HTMLInputElement>('[data-report-form] input')
		);
	}

	/** Edit, or "Add a report" after a delete, takes the focus back; the toast announces the result. */
	function close() {
		editing = false;
		void focusAfterUpdate(() => trigger);
	}

	/** Says what the save did, from the status it answered and the report read back after it. */
	function announceSave(status: ContentReportStatus) {
		close();
		if (status === 'held') {
			toasts.warn('Report saved. It waits for a moderator before it counts.');
		} else if (standing?.kind === 'young') {
			toasts.success(
				`Report saved. It counts from ${formatDate(standing.countsFrom)}, once the account is old enough.`
			);
		} else if (standing?.kind === 'rejected') {
			toasts.warn('Report saved. A moderator rejected it, so it does not count.');
		} else if (standing?.kind === 'restricted') {
			toasts.warn(`Report saved. It does not count while the account is ${standing.by}.`);
		} else {
			toasts.success('Report saved. The counts above include it once the page reloads.');
		}
	}
</script>

<div class="own" aria-busy={session.status === 'pending' || (session.status === 'user' && pending)}>
	{#if session.status === 'anon'}
		<p class="line">
			<a class="link signin" href={signInHref}>Sign in to add a report</a>
		</p>
	{:else if session.status === 'user' && !pending}
		{#if reports.errors.viewer}
			<Notice tone="error">{reports.errors.viewer}</Notice>
			<button class="btn btn--ink retry" type="button" onclick={() => reports.loadViewer()}>
				Try again
			</button>
		{:else}
			{#if showLine}
				<div class="line">
					<span class="mine" id="report-own-title">This account’s report</span>
					{#if report && label}
						<Badge tone={label.tone}>{label.label}</Badge>
						{#if !mutedUntil && !editing}
							<span class="sep" aria-hidden="true">·</span>
							<button class="link edit" type="button" bind:this={trigger} onclick={show}>
								Edit
							</button>
						{/if}
					{/if}
				</div>
			{/if}
			{#if mutedUntil}
				<Notice tone="warn">
					This account is muted and cannot add, edit or delete community reports until {formatDate(
						mutedUntil
					)}.
				</Notice>
			{:else if editing}
				<CommunityReportForm
					state={reports}
					bind:draft
					labelledby="report-own-title"
					saved={report !== null}
					onsaved={announceSave}
					ondeleted={close}
					oncancel={close}
				/>
			{:else if !report}
				<div class="line">
					<button class="btn btn--ink" type="button" bind:this={trigger} onclick={show}>
						Add a report
					</button>
				</div>
			{/if}
		{/if}
	{/if}
</div>

<style lang="postcss">
	@reference "../../../../app.css";

	/* The line's height while the session or the reader's report loads, so the form below does not move. */
	.own {
		@apply flex flex-col;
		gap: var(--spacing-sm);
		min-height: 2.5rem;
	}

	.line {
		@apply flex flex-wrap items-center gap-sm text-sm;
		min-height: 2.5rem;
	}

	.mine {
		@apply font-semibold;
	}

	.sep {
		@apply text-ink-muted;
	}

	.edit,
	.signin {
		@apply inline-flex items-center cursor-pointer text-sm;
		min-height: 1.5rem;
	}

	.retry {
		@apply self-start;
	}

	@media (pointer: coarse) {
		.line,
		.own {
			min-height: 2.75rem;
		}

		.edit,
		.signin {
			min-height: 2.75rem;
		}
	}
</style>
