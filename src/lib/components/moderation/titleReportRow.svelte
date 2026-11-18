<script lang="ts">
	import AccountLink from '#lib/components/moderation/accountLink.svelte';
	import Badge from '#lib/components/ui/badge.svelte';
	import CountRejectForms from '#lib/components/moderation/countRejectForms.svelte';
	import ReportAccountActions from '#lib/components/moderation/reportAccountActions.svelte';
	import ReportAnswers from '#lib/components/moderation/reportAnswers.svelte';
	import ReportRowShell from '#lib/components/moderation/reportRowShell.svelte';
	import type { TitleReport } from '#lib/media/types/moderation.ts';
	import { formatDate } from '#lib/media/utils/format.ts';
	import { accountLine } from '#lib/media/utils/reportAccount.ts';
	import { effectiveStanding, moderatorStandingLabel } from '#lib/media/utils/reportStanding.ts';
	import { HOLD_REASON_LABELS } from '#lib/media/utils/communityReports.ts';
	import { rowSubmit } from '#lib/media/utils/rowSubmit.ts';

	interface Props {
		report: TitleReport;
		titleId: string;
		/** Whether the acting staff member may count, reject or reject all the reports of this account. */
		canAct: boolean;
		/** Whether they may mute or ban it. */
		canRestrict: boolean;
		/** The acting staff member's role, for the account's End mute and Lift ban. */
		me: { id: string; role: string };
	}

	let { report, titleId, canAct, canRestrict, me }: Props = $props();

	let busy = $state<string | null>(null);
	let root: HTMLElement | undefined = $state();
	const submit = rowSubmit(
		() => root,
		(name) => (busy = name)
	);

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

<ReportRowShell
	bind:root
	readOnly={canAct ? undefined : 'An administrator decides on this report.'}
>
	{#snippet name()}<AccountLink
			id={report.account.userId}
			username={report.account.username}
			name={report.account.username ?? 'An account'}
		/>{/snippet}
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
		{#if canAct}
			<CountRejectForms
				userId={report.account.userId}
				{titleId}
				status={report.status}
				{busy}
				{submit}
			/>
		{/if}
	{/snippet}
	{#snippet footer()}
		<ReportAccountActions account={report.account} {canAct} {canRestrict} {me} />
	{/snippet}
</ReportRowShell>
