<script lang="ts">
	import TableRow from '#lib/components/moderation/table/tableRow.svelte';
	import type { ModerationTableRow } from '#lib/media/types/moderation.ts';
	import { canActOn } from '#lib/media/utils/canActOn.ts';
	import { focusAfterUpdate } from '#lib/media/utils/focus.ts';
	import { pressPanelButton, pressesButton, shortcutOf } from '#lib/media/utils/moderationKeys.ts';
	import { moderationPrefs } from '#lib/media/utils/moderationPrefs.svelte.js';
	import { TABLE_FOCUS } from '#lib/media/utils/tableChips.ts';

	interface Props {
		rows: ModerationTableRow[];
		me: { id: string; role: string };
		/** The ids of the rows ticked for a bulk action. */
		selected: string[];
	}

	let { rows, me, selected = $bindable() }: Props = $props();

	/** The row whose detail is open: the full comment with every action. */
	let openId = $state<string | null>(null);

	/**
	 * With a detail open, j and k open the next and previous row's, and a letter presses the open
	 * detail's button. With none open the keys do nothing: Review is the way in.
	 */
	function onkeydown(event: KeyboardEvent) {
		if (openId === null) return;
		const shortcut = shortcutOf(event, moderationPrefs.shortcuts);
		if (!shortcut) return;
		if (shortcut === 'next' || shortcut === 'previous') {
			event.preventDefault();
			const target =
				rows[rows.findIndex((r) => r.comment.id === openId) + (shortcut === 'next' ? 1 : -1)];
			if (!target) return;
			openId = target.comment.id;
			void focusAfterUpdate(() => document.getElementById(`review-${target.comment.id}`));
		} else if (pressesButton(shortcut) && !event.repeat) {
			if (pressPanelButton(document.getElementById(`detail-${openId}`), shortcut)) {
				event.preventDefault();
			}
		}
	}
</script>

<svelte:window {onkeydown} />

<!-- The focus lands here when an action takes its row off the page and no neighbour can take it. -->
<div class="card" id={TABLE_FOCUS.card} tabindex="-1">
	{#if rows.length === 0}
		<p class="empty">No comments match these filters.</p>
	{:else}
		{#if rows.some((row) => !canActOn(me, row.author))}
			<p id="not-selectable" class="sr-only">
				An administrator decides on comments by moderators and administrators, so these are not
				selectable.
			</p>
		{/if}
		<div class="scroll">
			<table>
				<caption class="sr-only">
					{rows.length}
					{rows.length === 1 ? 'comment' : 'comments'} on this page, with the automatic check, open reports
					and latest scan of each
				</caption>
				<thead>
					<tr>
						<th scope="col" class="select"><span class="sr-only">Select</span></th>
						<th scope="col" class="comment">Comment</th>
						<th scope="col" class="author">Author</th>
						<th scope="col" class="title">Title</th>
						<th scope="col">Status</th>
						<th scope="col">Automatic check</th>
						<th scope="col">Reports</th>
						<th scope="col" class="scan">Scan</th>
						<th scope="col" class="posted">Posted</th>
						<th scope="col" class="actions"><span class="sr-only">Actions</span></th>
					</tr>
				</thead>
				<tbody>
					{#each rows as row (row.comment.id)}
						<TableRow
							{row}
							{me}
							bind:selected
							open={openId === row.comment.id}
							ontoggle={() => (openId = openId === row.comment.id ? null : row.comment.id)}
						/>
					{/each}
				</tbody>
			</table>
		</div>
	{/if}
</div>

<style lang="postcss">
	@reference "../../../../app.css";

	.card {
		/* Rounds the corners of the scroll box inside. */
		overflow: clip;
	}

	.empty {
		@apply text-ink-muted;
		padding: var(--spacing-lg) var(--spacing-md);
	}

	/* The table keeps its columns at every width: where they do not fit, it scrolls sideways inside the card. */
	.scroll {
		overflow-x: auto;
		container-type: inline-size;
	}

	table {
		@apply w-full text-sm border-collapse;
		min-width: 64rem;
	}

	/* The cells belong to `tableRow` and `tableDetail`; the table sets what they share. */
	table :global(th),
	table :global(td) {
		@apply text-left align-top;
		padding: var(--spacing-sm);
		border-bottom: 1px solid var(--border);
	}

	/* Short values stay on one line, so every row reads across at the same height. */
	table :global(td:not(.comment, .title, .scan, .author)) {
		white-space: nowrap;
	}

	th {
		@apply font-medium text-ink-muted;
		white-space: nowrap;
		background-color: var(--surface-raised);
		border-bottom-color: var(--border-strong);
	}

	table :global(tbody tr:last-child td) {
		border-bottom: 0;
	}

	.select {
		width: 2.5rem;
		padding: 0;
	}

	/* The actions column stays in view at the row's end while the table scrolls sideways. */
	.actions {
		position: sticky;
		right: 0;
		padding-right: var(--spacing-md);
		background-color: var(--surface-raised);
		box-shadow: inset 1px 0 0 var(--border);
	}
</style>
