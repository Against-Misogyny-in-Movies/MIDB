<script lang="ts">
	import Notice from '#lib/components/ui/notice.svelte';
	import type { ReaderReportsState } from '#lib/media/utils/readerReportsState.svelte.js';
	import { REPORT_NOTE_MAX } from '#lib/media/utils/comments.ts';
	import { focusAfterUpdate } from '#lib/media/utils/focus.ts';

	interface Props {
		state: ReaderReportsState;
	}

	let { state: reports }: Props = $props();

	let open = $state(false);
	let note = $state('');
	let trigger: HTMLButtonElement | undefined = $state();
	let field: HTMLTextAreaElement | undefined = $state();
	let sent: HTMLDivElement | undefined = $state();

	function show() {
		open = true;
		void focusAfterUpdate(() => field);
	}

	function close() {
		open = false;
		void focusAfterUpdate(() => trigger);
	}

	async function submit(event: SubmitEvent) {
		event.preventDefault();
		if (reports.busy.flag) return;
		if (await reports.flag(note)) {
			note = '';
			open = false;
			void focusAfterUpdate(() => sent);
		}
	}
</script>

<div class="flag">
	{#if open}
		<form class="plate form" onsubmit={submit}>
			<label class="note">
				<span class="label">Note (optional)</span>
				<textarea
					class="input field"
					rows="2"
					maxlength={REPORT_NOTE_MAX}
					bind:value={note}
					bind:this={field}></textarea>
			</label>
			<div class="row">
				<button class="btn btn--ink" type="submit" disabled={reports.busy.flag}>
					{reports.busy.flag ? 'Sending…' : 'Send'}
				</button>
				<button class="btn btn--ghost" type="button" onclick={close}>Cancel</button>
				<span class="label count">{note.length} / {REPORT_NOTE_MAX}</span>
			</div>
			{#if reports.errors.flag}
				<Notice tone="error">{reports.errors.flag}</Notice>
			{/if}
		</form>
	{:else if reports.flagged}
		<div class="sent" tabindex="-1" bind:this={sent}>
			<Notice tone="success">Counts flagged. Moderators review them.</Notice>
		</div>
	{:else}
		<button class="link wrong" type="button" bind:this={trigger} onclick={show}>
			Counts look wrong
		</button>
	{/if}
</div>

<style lang="postcss">
	@reference "../../../../app.css";

	.form {
		@apply flex flex-col;
		gap: var(--spacing-sm);
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
		@apply ml-auto tabular-nums;
	}

	/* Focused by the code once the flag went out; there is nothing to operate on it. */
	.sent:focus {
		outline: none;
	}

	.wrong {
		@apply inline-flex items-center cursor-pointer text-sm;
		min-height: 1.5rem;
	}

	@media (pointer: coarse) {
		/* Focused by the code once the flag went out; there is nothing to operate on it. */
		.sent:focus {
			outline: none;
		}

		.wrong {
			min-height: 2.75rem;
		}
	}
</style>
