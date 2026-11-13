<script lang="ts">
	import { enhance } from '$app/forms';
	import Notice from '#lib/components/ui/notice.svelte';
	import ReportAnswers from '#lib/components/moderation/reportAnswers.svelte';
	import type { ActionOutcome, HeldReport } from '#lib/media/types/moderation.ts';
	import { formatDate } from '#lib/media/utils/format.ts';
	import { HOLD_REASON_LABELS } from '#lib/media/utils/readerReports.ts';
	import { rowSubmit } from '#lib/media/utils/rowSubmit.ts';
	import { titleHref } from '#lib/media/utils/titleHref.ts';
	import { accountLine } from '#lib/media/utils/reportAccount.ts';

	interface Props {
		report: HeldReport;
		outcome: ActionOutcome;
	}

	let { report, outcome }: Props = $props();

	let busy = $state<string | null>(null);
	let root: HTMLElement | undefined = $state();
	const submit = rowSubmit(
		() => root,
		(name) => (busy = name)
	);

	const key = $derived(`${report.account.userId}:${report.titleId}`);
	const mine = $derived(outcome?.id === key ? outcome : null);
	const href = $derived(titleHref(report.title.kind, report.title.tmdbId));
</script>

<li class="item" tabindex="-1" bind:this={root}>
	<header class="meta">
		<span class="name">
			{#if href}<a class="link" {href}>{report.title.name}</a>{:else}{report.title.name}{/if}
		</span>
		<span class="label">{report.holdReason ? HOLD_REASON_LABELS[report.holdReason] : 'Held'}</span>
		<time class="label" datetime={report.createdAt}>{formatDate(report.createdAt)}</time>
	</header>
	<p class="label">{accountLine(report.account)}</p>

	<ReportAnswers answers={report.answers} um={report.um} />

	<div class="actions">
		{#each [{ name: 'countReport', label: 'Count it', busy: 'Counting…', style: 'btn--ink' }, { name: 'rejectReport', label: 'Reject', busy: 'Rejecting…', style: 'btn--ghost' }] as action (action.name)}
			<form method="POST" action="?/{action.name}" use:enhance={submit(action.name)}>
				<input type="hidden" name="userId" value={report.account.userId} />
				<input type="hidden" name="titleId" value={report.titleId} />
				<button class="btn {action.style}" disabled={busy !== null}>
					{busy === action.name ? action.busy : action.label}
				</button>
			</form>
		{/each}
	</div>

	{#if mine?.error}<Notice tone="error">{mine.error}</Notice>{/if}
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
