<script lang="ts">
	import type { CommunityReportsState } from '#lib/media/utils/communityReportsState.svelte.js';
	import { REPORT_NOTE_MAX } from '#lib/media/utils/comments.ts';
	import { focusAfterUpdate } from '#lib/media/utils/focus.ts';

	interface Props {
		state: CommunityReportsState;
		/** Hides the "Counts look wrong" link while the report form is open; an open plate stays. */
		hideTrigger?: boolean;
	}

	let { state: reports, hideTrigger = false }: Props = $props();

	let open = $state(false);
	let note = $state('');
	let trigger: HTMLButtonElement | undefined = $state();
	let field: HTMLTextAreaElement | undefined = $state();

	function show() {
		open = true;
		void focusAfterUpdate(() => field);
	}

	/** Hands the focus back to the link, or to the open report form while the link is hidden. */
	function close() {
		open = false;
		void focusAfterUpdate(
			() => trigger ?? document.querySelector<HTMLElement>('[data-report-form] input') ?? undefined
		);
	}

	async function submit(event: SubmitEvent) {
		event.preventDefault();
		if (reports.busy.flag) return;
		if (await reports.flag(note)) {
			note = '';
			close();
		}
	}
</script>

<div class="flag">
	{#if open}
		<form class="plate form" aria-labelledby="report-flag-title" onsubmit={submit}>
			<p id="report-flag-title" class="intro">
				Asks the moderators to review this title’s community reports.
			</p>
			<label class="note">
				<span class="label">What looks wrong (optional)</span>
				<textarea
					class="input field"
					rows="2"
					aria-describedby="report-flag-count"
					maxlength={REPORT_NOTE_MAX}
					bind:value={note}
					bind:this={field}></textarea>
			</label>
			<div class="row">
				<button class="btn btn--ink" type="submit" aria-busy={reports.busy.flag ?? false}>
					Send to moderators
				</button>
				<button class="btn btn--ghost" type="button" onclick={close}>Cancel</button>
				<span id="report-flag-count" class="label count">{note.length} / {REPORT_NOTE_MAX}</span>
			</div>
		</form>
	{:else if !hideTrigger}
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

	.intro {
		@apply text-sm;
		margin: 0;
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

	.wrong {
		@apply inline-flex items-center cursor-pointer text-sm;
		min-height: 1.5rem;
	}

	@media (pointer: coarse) {
		.wrong {
			min-height: 2.75rem;
		}
	}
</style>
