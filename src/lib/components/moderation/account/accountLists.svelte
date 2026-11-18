<script lang="ts">
	import AccountCommentRow from '#lib/components/moderation/account/accountCommentRow.svelte';
	import AccountReportRow from '#lib/components/moderation/account/accountReportRow.svelte';
	import ReportAgainstRow from '#lib/components/moderation/account/reportAgainstRow.svelte';
	import type {
		AccountComment,
		AccountFigures,
		AccountReport,
		ReportAgainst
	} from '#lib/media/types/moderation.ts';

	interface Props {
		comments: AccountComment[];
		reports: AccountReport[];
		against: ReportAgainst[];
		/** The totals the lists are the newest of. */
		figures: AccountFigures;
	}

	let { comments, reports, against, figures }: Props = $props();

	type Id = 'comments' | 'reports' | 'against';
	let open = $state<Id>('comments');

	const TABS = $derived([
		{ id: 'comments' as const, label: 'Comments', shown: comments.length, total: figures.comments },
		{
			id: 'reports' as const,
			label: 'Community reports',
			shown: reports.length,
			total: figures.communityReports
		},
		{
			id: 'against' as const,
			label: 'Open reports against',
			shown: against.length,
			total: figures.openReportsAgainst
		}
	]);
	const tab = $derived(TABS.find((t) => t.id === open) ?? TABS[0]);

	/** The tab keyboard pattern: arrows (wrapping), Home and End; the focused tab is the selected one. */
	function onkeydown(event: KeyboardEvent, index: number) {
		const last = TABS.length - 1;
		const target =
			event.key === 'ArrowRight'
				? index === last
					? 0
					: index + 1
				: event.key === 'ArrowLeft'
					? index === 0
						? last
						: index - 1
					: event.key === 'Home'
						? 0
						: event.key === 'End'
							? last
							: null;
		if (target === null) return;
		event.preventDefault();
		open = TABS[target].id;
		document.getElementById(`account-tab-${TABS[target].id}`)?.focus();
	}
</script>

<section class="lists" aria-label="Account lists">
	<div class="tabs" role="tablist" aria-label="Account lists">
		{#each TABS as t, i (t.id)}
			<button
				class="chip"
				type="button"
				role="tab"
				id="account-tab-{t.id}"
				aria-selected={open === t.id}
				aria-controls="account-panel"
				tabindex={open === t.id ? 0 : -1}
				onclick={() => (open = t.id)}
				onkeydown={(event) => onkeydown(event, i)}
			>
				{t.label} <span class="count">{t.total}</span>
			</button>
		{/each}
	</div>

	<div id="account-panel" role="tabpanel" aria-labelledby="account-tab-{tab.id}">
		{#if tab.total === 0}
			<p class="empty">
				{tab.id === 'comments'
					? 'This account has no comments.'
					: tab.id === 'reports'
						? 'This account has no community reports.'
						: 'No open reports against this account’s comments.'}
			</p>
		{:else}
			<ul class="card row-list">
				{#if tab.id === 'comments'}
					{#each comments as comment (comment.id)}<AccountCommentRow {comment} />{/each}
				{:else if tab.id === 'reports'}
					{#each reports as report (report.titleId)}<AccountReportRow {report} />{/each}
				{:else}
					{#each against as report (report.comment.id + report.reporterId)}
						<ReportAgainstRow {report} />
					{/each}
				{/if}
			</ul>
			{#if tab.total > tab.shown}
				<p class="label more">Showing the newest {tab.shown} of {tab.total}.</p>
			{/if}
		{/if}
	</div>
</section>

<style lang="postcss">
	@reference "../../../../app.css";

	.lists {
		@apply flex flex-col;
		gap: var(--spacing-md);
	}

	.tabs {
		@apply flex flex-wrap;
		gap: var(--spacing-sm);
	}

	/* A touch target is 44px on a coarse pointer, like the buttons. */
	@media (pointer: coarse) {
		.chip {
			height: 2.75rem;
		}
	}

	/* The selected tab also takes the heavier weight and the wash, so colour is not the only mark. */
	.chip[aria-selected='true'] {
		border-color: var(--brand);
		background-color: var(--brand-wash);
		color: var(--brand);
		font-weight: 600;
	}

	.count {
		font-variant-numeric: tabular-nums;
	}

	.empty {
		@apply text-ink-muted;
	}

	.more {
		margin-top: var(--spacing-sm);
	}
</style>
