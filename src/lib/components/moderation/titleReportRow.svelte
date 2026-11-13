<script lang="ts">
	import { enhance } from '$app/forms';
	import Badge from '#lib/components/ui/badge.svelte';
	import Notice from '#lib/components/ui/notice.svelte';
	import ReportAccountActions from '#lib/components/moderation/reportAccountActions.svelte';
	import ReportAnswers from '#lib/components/moderation/reportAnswers.svelte';
	import type { ActionOutcome, TitleReport } from '#lib/media/types/moderation.ts';
	import { formatDate } from '#lib/media/utils/format.ts';
	import { accountLine } from '#lib/media/utils/reportAccount.ts';
	import { HOLD_REASON_LABELS } from '#lib/media/utils/readerReports.ts';
	import { rowSubmit } from '#lib/media/utils/rowSubmit.ts';
	import { reportStatusTone } from '#lib/media/utils/tones.ts';

	interface Props {
		report: TitleReport;
		titleId: string;
		outcome: ActionOutcome;
	}

	let { report, titleId, outcome }: Props = $props();

	let busy = $state<string | null>(null);
	let root: HTMLElement | undefined = $state();
	const submit = rowSubmit(
		() => root,
		(name) => (busy = name)
	);

	const key = $derived(`${report.account.userId}:${titleId}`);
	const mine = $derived(outcome?.id === key ? outcome : null);
	const STATUS: Record<TitleReport['status'], string> = {
		counted: 'Counted',
		held: 'Waiting for review',
		rejected: 'Rejected'
	};
</script>

<li class="item" tabindex="-1" bind:this={root}>
	<header class="meta">
		<span class="name">{report.account.username ?? 'An account'}</span>
		<Badge tone={reportStatusTone(report.status)}>{STATUS[report.status]}</Badge>
		{#if report.holdReason}<span class="label">{HOLD_REASON_LABELS[report.holdReason]}</span>{/if}
		<time class="label" datetime={report.createdAt}>{formatDate(report.createdAt)}</time>
	</header>
	<p class="label">{accountLine(report.account)}</p>

	<ReportAnswers answers={report.answers} />

	<div class="actions">
		{#if report.status !== 'counted'}
			<form method="POST" action="?/countReport" use:enhance={submit('countReport')}>
				<input type="hidden" name="userId" value={report.account.userId} />
				<input type="hidden" name="titleId" value={titleId} />
				<button class="btn btn--ink" disabled={busy !== null}>
					{busy === 'countReport' ? 'Counting…' : 'Count it'}
				</button>
			</form>
		{/if}
		{#if report.status !== 'rejected'}
			<form method="POST" action="?/rejectReport" use:enhance={submit('rejectReport')}>
				<input type="hidden" name="userId" value={report.account.userId} />
				<input type="hidden" name="titleId" value={titleId} />
				<button class="btn btn--ghost" disabled={busy !== null}>
					{busy === 'rejectReport' ? 'Rejecting…' : 'Reject'}
				</button>
			</form>
		{/if}
	</div>
	{#if mine?.error}<Notice tone="error">{mine.error}</Notice>{/if}

	<ReportAccountActions
		account={report.account}
		{outcome}
		canRejectAll={report.account.reportCount > 0}
	/>
</li>

<style lang="postcss">
	@reference "../../../app.css";

	.item {
		@apply flex flex-col;
		gap: var(--spacing-sm);
		padding: 16px 20px;
	}

	.meta {
		@apply flex flex-wrap items-center text-sm;
		gap: var(--spacing-xs) var(--spacing-sm);
	}

	.name {
		@apply font-semibold;
	}

	.actions {
		@apply flex flex-wrap;
		gap: var(--spacing-sm);
	}
</style>
