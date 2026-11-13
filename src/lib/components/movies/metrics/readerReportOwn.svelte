<script lang="ts">
	import Badge from '#lib/components/ui/badge.svelte';
	import Notice from '#lib/components/ui/notice.svelte';
	import ReaderReportForm from './readerReportForm.svelte';
	import type { ReaderReportsState } from '#lib/media/utils/readerReportsState.svelte.js';
	import { draftFromReport, emptyDraft, type ReportDraft } from '#lib/media/utils/reportDraft.ts';
	import { reportStanding } from '#lib/media/utils/reportStanding.ts';
	import { focusAfterUpdate } from '#lib/media/utils/focus.ts';
	import { formatDate } from '#lib/media/utils/format.ts';
	import { session } from '#lib/media/utils/session.svelte.js';

	interface Props {
		state: ReaderReportsState;
		/** Where `/auth` sends the reader back to after signing in. */
		signInHref: string;
	}

	let { state: reports, signInHref }: Props = $props();

	let open = $state(false);
	let draft = $state<ReportDraft>(emptyDraft());
	let trigger: HTMLButtonElement | undefined = $state();

	const report = $derived(reports.viewer?.report ?? null);
	const mutedUntil = $derived(reports.viewer?.mutedUntil ?? null);
	const standing = $derived(report ? reportStanding(report) : null);
	/** A signed-in reader waits for their own report before the line shows, so a mute can replace it. */
	const pending = $derived(reports.viewerPhase === 'idle' || reports.viewerPhase === 'loading');

	function show() {
		draft = report ? draftFromReport(report) : emptyDraft();
		open = true;
		void focusAfterUpdate(() =>
			document.querySelector<HTMLInputElement>('[data-report-form] input')
		);
	}

	function close() {
		open = false;
		void focusAfterUpdate(() => trigger);
	}
</script>

<div class="own" aria-busy={session.status === 'pending' || (session.status === 'user' && pending)}>
	{#if session.status === 'anon'}
		<p class="line"><a class="link" href={signInHref}>Sign in to add a report</a></p>
	{:else if session.status === 'user' && !pending}
		{#if reports.errors.viewer}
			<Notice tone="error">{reports.errors.viewer}</Notice>
		{:else if mutedUntil}
			<Notice tone="warn">
				This account is muted and cannot add, edit or delete reader reports until {formatDate(
					mutedUntil
				)}.
			</Notice>
		{:else if open}
			<ReaderReportForm
				state={reports}
				bind:draft
				saved={report !== null}
				ondone={close}
				oncancel={close}
			/>
		{:else if report && standing}
			<div class="line">
				<span class="mine">Your report</span>
				<Badge tone={standing.tone}>{standing.label}</Badge>
				<span class="sep" aria-hidden="true">·</span>
				<button class="link edit" type="button" bind:this={trigger} onclick={show}>Edit</button>
			</div>
			{#if reports.saved?.status === 'held'}
				<Notice tone="warn">Report saved. It waits for a moderator before it counts.</Notice>
			{:else if reports.saved}
				<Notice tone="success">Report saved.</Notice>
			{/if}
		{:else}
			<div class="line">
				<button class="btn btn--ink" type="button" bind:this={trigger} onclick={show}>
					Add a report
				</button>
			</div>
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

	.edit {
		@apply inline-flex items-center cursor-pointer text-sm;
		min-height: 1.5rem;
	}

	@media (pointer: coarse) {
		.line,
		.own {
			min-height: 2.75rem;
		}

		.edit {
			min-height: 2.75rem;
		}
	}
</style>
