<script lang="ts">
	import Badge from '#lib/components/ui/badge.svelte';
	import Notice from '#lib/components/ui/notice.svelte';
	import CountRejectForms from '#lib/components/moderation/countRejectForms.svelte';
	import ReportAnswers from '#lib/components/moderation/reportAnswers.svelte';
	import ReportRowShell from '#lib/components/moderation/reportRowShell.svelte';
	import type { ActionOutcome, HeldReport } from '#lib/media/types/moderation.ts';
	import { formatDate } from '#lib/media/utils/format.ts';
	import { HOLD_REASON_LABELS } from '#lib/media/utils/communityReports.ts';
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

<ReportRowShell bind:root>
	{#snippet name()}
		{#if href}<a class="link" {href}>{report.title.name}</a>{:else}{report.title.name}{/if}
	{/snippet}
	{#snippet meta()}
		<Badge tone="neutral">
			{report.holdReason ? HOLD_REASON_LABELS[report.holdReason] : 'Held'}
		</Badge>
		<time class="label" datetime={report.createdAt}>{formatDate(report.createdAt)}</time>
	{/snippet}
	<p class="label">{accountLine(report.account)}</p>
	<ReportAnswers answers={report.answers} um={report.um} />
	{#snippet actions()}
		<CountRejectForms
			userId={report.account.userId}
			titleId={report.titleId}
			status="held"
			{busy}
			{submit}
		/>
	{/snippet}
	{#snippet footer()}
		{#if mine?.error}<Notice tone="error">{mine.error}</Notice>{/if}
	{/snippet}
</ReportRowShell>
