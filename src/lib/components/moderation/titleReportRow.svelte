<script lang="ts">
	import Badge from '#lib/components/ui/badge.svelte';
	import Notice from '#lib/components/ui/notice.svelte';
	import CountRejectForms from '#lib/components/moderation/countRejectForms.svelte';
	import ReportAccountActions from '#lib/components/moderation/reportAccountActions.svelte';
	import ReportAnswers from '#lib/components/moderation/reportAnswers.svelte';
	import ReportRowShell from '#lib/components/moderation/reportRowShell.svelte';
	import type { ActionOutcome, TitleReport } from '#lib/media/types/moderation.ts';
	import { formatDate } from '#lib/media/utils/format.ts';
	import { accountLine } from '#lib/media/utils/reportAccount.ts';
	import { effectiveStanding, moderatorStandingLabel } from '#lib/media/utils/reportStanding.ts';
	import { HOLD_REASON_LABELS } from '#lib/media/utils/communityReports.ts';
	import { rowSubmit } from '#lib/media/utils/rowSubmit.ts';

	interface Props {
		report: TitleReport;
		titleId: string;
		outcome: ActionOutcome;
		/** Whether the acting moderator may mute, ban or reject the reports of this account. */
		canAct: boolean;
	}

	let { report, titleId, outcome, canAct }: Props = $props();

	let busy = $state<string | null>(null);
	let root: HTMLElement | undefined = $state();
	const submit = rowSubmit(
		() => root,
		(name) => (busy = name)
	);

	const key = $derived(`${report.account.userId}:${titleId}`);
	const mine = $derived(outcome?.id === key ? outcome : null);
	const standing = $derived(
		moderatorStandingLabel(
			effectiveStanding({
				status: report.status,
				countsFrom: report.account.countsFrom,
				restricted: report.account.restricted
			})
		)
	);
</script>

<ReportRowShell bind:root>
	{#snippet name()}{report.account.username ?? 'An account'}{/snippet}
	{#snippet meta()}
		<Badge tone={standing.tone}>{standing.label}</Badge>
		{#if report.holdReason}
			<Badge tone="neutral">{HOLD_REASON_LABELS[report.holdReason]}</Badge>
		{/if}
		<time class="label" datetime={report.createdAt}>{formatDate(report.createdAt)}</time>
	{/snippet}
	<p class="label">{accountLine(report.account, false)}</p>
	<ReportAnswers answers={report.answers} um={report.um} />
	{#snippet actions()}
		<CountRejectForms
			userId={report.account.userId}
			{titleId}
			status={report.status}
			{busy}
			{submit}
		/>
	{/snippet}
	{#snippet footer()}
		{#if mine?.error}<Notice tone="error">{mine.error}</Notice>{/if}
		<ReportAccountActions account={report.account} {outcome} {canAct} />
	{/snippet}
</ReportRowShell>
