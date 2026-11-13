<script lang="ts">
	import Badge from '#lib/components/ui/badge.svelte';
	import type { ReportAnswerColumns } from '#lib/media/types/moderation.ts';
	import {
		CONCERN_FLAGS,
		NOT_SURE,
		REPORT_FRAMING_LABELS,
		answerLines,
		type ConcernFlagKey
	} from '#lib/media/utils/communityReports.ts';

	interface Props {
		answers: ReportAnswerColumns;
		/** UM's flags for the title, shown next to the reader's answers when present. */
		um?: Record<ConcernFlagKey, boolean> | null;
	}

	let { answers, um = null }: Props = $props();

	const lines = $derived(answerLines(answers));
	/** The flags are asked only when sexual violence is Present, so otherwise they were not asked. */
	const asked = $derived(answers.sexualPresent === 'present');
	const answered = (value: boolean | null) =>
		!asked ? 'Not asked' : value === null ? NOT_SURE : value ? 'Yes' : 'No';
	const flagged = $derived(CONCERN_FLAGS.filter((f) => answers[f.key] === true));
	/** The rows where the reader's Yes or No is the opposite of UM's, first. */
	const rows = $derived(
		CONCERN_FLAGS.map((flag) => {
			const reader = answers[flag.key];
			return { flag, differs: um !== null && reader !== null && reader !== um[flag.key] };
		}).sort((a, b) => Number(b.differs) - Number(a.differs))
	);
</script>

<dl class="answers">
	{#each lines as line (line.key)}
		<div class="row">
			<dt class="label">{line.label}</dt>
			<dd>{line.value}</dd>
		</div>
	{/each}
	{#if answers.framing}
		<div class="row">
			<dt class="label">Framing</dt>
			<dd>{REPORT_FRAMING_LABELS[answers.framing]}</dd>
		</div>
	{/if}
</dl>

{#if um}
	<table class="flags">
		<caption class="label">Reader answers next to Unconsenting Media</caption>
		<thead>
			<tr>
				<th scope="col" class="label">Flag</th>
				<th scope="col" class="label">Reader</th>
				<th scope="col" class="label">Unconsenting Media</th>
			</tr>
		</thead>
		<tbody>
			{#each rows as { flag, differs } (flag.key)}
				<tr>
					<th scope="row">
						{flag.label}
						{#if differs}<Badge tone="mid">Differs</Badge>{/if}
					</th>
					<td>{answered(answers[flag.key])}</td>
					<td>{um[flag.key] ? 'Yes' : 'No'}</td>
				</tr>
			{/each}
		</tbody>
	</table>
{:else if flagged.length > 0}
	<p class="text-sm">Flags: {flagged.map((f) => f.label).join('; ')}</p>
{/if}

<style lang="postcss">
	@reference "../../../app.css";

	.answers {
		@apply m-0 text-sm;
		display: grid;
		gap: var(--spacing-xs) var(--spacing-md);
		grid-template-columns: repeat(auto-fit, minmax(14rem, 1fr));
	}

	.row {
		@apply flex flex-col;
	}

	dd {
		@apply m-0;
	}

	.flags {
		@apply w-full text-sm text-left;
		border-collapse: collapse;
	}

	.flags caption {
		@apply text-left;
		padding-bottom: var(--spacing-xs);
	}

	.flags th,
	.flags td {
		padding-block: var(--spacing-xs);
		padding-inline: var(--spacing-sm);
		border-top: 1px solid var(--border);
	}

	.flags tbody th {
		@apply font-normal;
	}

	.flags thead th {
		border-top: 0;
	}
</style>
