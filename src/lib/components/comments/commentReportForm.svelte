<script lang="ts">
	import { onMount } from 'svelte';
	import type { ReportReason } from '#lib/media/types/comments.ts';
	import {
		REPORT_NOTE_MAX,
		REPORT_REASON_LABELS,
		reportReason
	} from '#lib/media/utils/comments.ts';
	import type { CommentsState } from '#lib/media/utils/commentsState.svelte.js';

	interface Props {
		commentId: string;
		state: CommentsState;
		onclose: () => void;
		/** The report went through: its result is a toast, and the form closes. */
		onsent: () => void;
	}

	let { commentId, state: comments, onclose, onsent }: Props = $props();

	let reason = $state<ReportReason | null>(null);
	let reasons: HTMLFieldSetElement | undefined = $state();

	// The form opens from the comment's menu, whose item leaves the page: the focus moves to the first reason.
	onMount(() => reasons?.querySelector<HTMLInputElement>('input')?.focus());
	let note = $state('');
	const key = $derived(`report:${commentId}`);

	async function submit(event: SubmitEvent) {
		event.preventDefault();
		if (!reason || comments.busy[key]) return;
		if (await comments.report(commentId, { reason, note })) onsent();
	}
</script>

<form class="plate report" onsubmit={submit}>
	<fieldset class="reasons" bind:this={reasons}>
		<legend class="label">Reason for the report</legend>
		{#each reportReason as value (value)}
			<label class="reason">
				<input type="radio" name="reason-{commentId}" {value} bind:group={reason} />
				{REPORT_REASON_LABELS[value]}
			</label>
		{/each}
	</fieldset>
	<label class="note">
		<span class="label">Note (optional)</span>
		<textarea class="input field" rows="2" maxlength={REPORT_NOTE_MAX} bind:value={note}></textarea>
	</label>
	<div class="row">
		<button
			class="btn btn--ink"
			type="submit"
			aria-busy={comments.busy[key] ?? false}
			disabled={!reason}
		>
			Send report
		</button>
		<button class="btn btn--ghost" type="button" onclick={onclose}>Cancel</button>
		<span class="label count">{note.length} / {REPORT_NOTE_MAX}</span>
	</div>
</form>

<style lang="postcss">
	@reference "../../../app.css";

	.report {
		@apply flex flex-col;
		gap: var(--spacing-sm);
	}

	.reasons {
		@apply flex flex-wrap;
		gap: var(--spacing-xs) var(--spacing-md);
		border: 0;
		margin: 0;
		padding: 0;
	}

	.reasons legend {
		@apply w-full;
		margin-bottom: var(--spacing-xs);
	}

	.reason {
		@apply inline-flex items-center gap-xs text-sm cursor-pointer;
		min-height: 1.75rem;
	}

	.reason input {
		accent-color: var(--brand);
	}

	.note {
		@apply flex flex-col;
		gap: var(--spacing-xs);
	}

	.field {
		height: auto;
		min-height: 4rem;
		padding-block: 10px;
		resize: vertical;
		line-height: 1.5;
	}

	.row {
		@apply flex flex-wrap items-center;
		gap: var(--spacing-sm);
	}

	.count {
		@apply ml-auto;
		font-variant-numeric: tabular-nums;
	}

	@media (pointer: coarse) {
		.reason {
			min-height: 2.75rem;
		}
	}
</style>
