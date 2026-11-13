<script lang="ts">
	import Notice from '#lib/components/ui/notice.svelte';
	import ReportChoice from './reportChoice.svelte';
	import type { ReaderReportsState } from '#lib/media/utils/readerReportsState.svelte.js';
	import {
		CONCERN_FLAGS,
		NOT_SURE,
		OBJECTIFICATION_LEVEL_LABELS,
		REPORT_CATEGORIES,
		REPORT_FRAMING_LABELS,
		REPORT_LEVEL_LABELS,
		SEXUAL_LEVEL_LABELS,
		type ReportCategory,
		type ReportFraming
	} from '#lib/media/utils/readerReports.ts';
	import {
		UNSURE,
		asksFlags,
		asksFraming,
		canSave,
		type ReportDraft
	} from '#lib/media/utils/reportDraft.ts';

	interface Props {
		state: ReaderReportsState;
		draft: ReportDraft;
		/** Whether the reader already has a report, which Delete would withdraw. */
		saved: boolean;
		/** Runs after a save or a delete went through. */
		ondone: () => void;
		oncancel: () => void;
	}

	let { state: reports, draft = $bindable(), saved, ondone, oncancel }: Props = $props();

	const unsure = [UNSURE, NOT_SURE] as const;
	const SEXUAL = [...Object.entries(SEXUAL_LEVEL_LABELS), unsure] as [
		'none' | 'present' | typeof UNSURE,
		string
	][];
	const LEVELS = [...Object.entries(REPORT_LEVEL_LABELS), unsure] as [
		'none' | 'mentioned' | 'on_screen' | typeof UNSURE,
		string
	][];
	const OBJECTIFICATION = [...Object.entries(OBJECTIFICATION_LEVEL_LABELS), unsure] as [
		'none' | 'some_scenes' | 'throughout' | typeof UNSURE,
		string
	][];
	const FLAG_ANSWERS = [['yes', 'Yes'], ['no', 'No'], unsure] as [
		'yes' | 'no' | typeof UNSURE,
		string
	][];
	const FRAMINGS = [...Object.entries(REPORT_FRAMING_LABELS), ['', 'No answer']] as [
		ReportFraming | '',
		string
	][];

	const category = (key: ReportCategory) => REPORT_CATEGORIES.find((c) => c.key === key)!;
	const sexual = category('sexual');
	const objectification = category('objectification');
	const violence = (['partner', 'physical', 'stalking'] as const).map(category);

	const busy = $derived(reports.busy.save === true || reports.busy.delete === true);

	async function submit(event: SubmitEvent) {
		event.preventDefault();
		if (!canSave(draft) || busy) return;
		if (await reports.save(draft)) ondone();
	}

	async function remove() {
		if (busy) return;
		if (await reports.remove()) ondone();
	}
</script>

<form class="plate form" aria-busy={busy} onsubmit={submit} data-report-form>
	<label class="watched">
		<input type="checkbox" bind:checked={draft.watched} required />
		<span>I watched this</span>
	</label>

	<ReportChoice
		legend={sexual.label}
		description={sexual.description}
		name="report-sexual"
		options={SEXUAL}
		bind:value={draft.sexual}
	/>

	{#if asksFlags(draft)}
		<div class="flags" role="group" aria-labelledby="report-flags-title">
			<p id="report-flags-title" class="flags-title">Unconsenting Media concerns</p>
			{#each CONCERN_FLAGS as flag (flag.key)}
				<ReportChoice
					compact
					legend={flag.label}
					name="report-flag-{flag.key}"
					options={FLAG_ANSWERS}
					bind:value={draft.flags[flag.key]}
				/>
			{/each}
		</div>
	{/if}

	{#each violence as c (c.key)}
		<ReportChoice
			legend={c.label}
			description={c.description}
			name="report-{c.key}"
			options={LEVELS}
			bind:value={draft[c.key as 'partner' | 'physical' | 'stalking']}
		/>
	{/each}

	<ReportChoice
		legend={objectification.label}
		description={objectification.description}
		name="report-objectification"
		options={OBJECTIFICATION}
		bind:value={draft.objectification}
	/>

	{#if asksFraming(draft)}
		<ReportChoice
			legend="How the title treats the violence (optional)"
			name="report-framing"
			options={FRAMINGS}
			bind:value={draft.framing}
		/>
	{/if}

	<div class="actions">
		<button class="btn btn--brand" type="submit" disabled={!canSave(draft) || busy}>
			{reports.busy.save ? 'Saving…' : 'Save report'}
		</button>
		<button class="btn btn--ghost" type="button" onclick={oncancel}>Cancel</button>
		{#if saved}
			<button class="btn btn--ghost delete" type="button" disabled={busy} onclick={remove}>
				{reports.busy.delete ? 'Deleting…' : 'Delete report'}
			</button>
		{/if}
	</div>
	{#if reports.errors.save}
		<Notice tone="error">{reports.errors.save}</Notice>
	{/if}
	{#if reports.errors.delete}
		<Notice tone="error">{reports.errors.delete}</Notice>
	{/if}
</form>

<style lang="postcss">
	@reference "../../../../app.css";

	.form {
		@apply flex flex-col;
		gap: var(--spacing-md);
	}

	.watched {
		@apply inline-flex items-center gap-sm text-sm font-semibold cursor-pointer;
		min-height: 1.75rem;
	}

	.watched input {
		accent-color: var(--brand);
		width: 1.125rem;
		height: 1.125rem;
	}

	/* The flag rows sit under their question on a hairline, not in a card. */
	.flags {
		@apply flex flex-col;
		gap: var(--spacing-sm);
		padding-left: var(--spacing-md);
		border-left: 1px solid var(--border);
	}

	.flags-title {
		@apply text-sm text-ink-muted;
		margin: 0;
	}

	.actions {
		@apply flex flex-wrap items-center;
		gap: var(--spacing-sm);
	}

	.delete {
		@apply sm:ml-auto;
	}

	@media (pointer: coarse) {
		.watched {
			min-height: 2.75rem;
		}
	}
</style>
