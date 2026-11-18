<script lang="ts">
	import ModerationItemRow from '#lib/components/moderation/moderationItem.svelte';
	import type { ModerationTableRow } from '#lib/media/types/moderation.ts';
	import { categoryLabel } from '#lib/media/utils/comments.ts';
	import { TABLE_FOCUS } from '#lib/media/utils/tableChips.ts';

	interface Props {
		row: ModerationTableRow;
		me: { id: string; role: string };
	}

	let { row, me }: Props = $props();

	/** The columns of the table, so the detail spans them all. */
	const COLUMNS = 10;
</script>

<!-- The row above shows the author, the title, the status and the start of the text, so the panel leaves them out. -->
<tr class="detail" id="detail-{row.comment.id}">
	<td colspan={COLUMNS}>
		<div class="detail-body">
			{#if row.latestLabel}
				<p class="scan-note label">
					Latest scan for “{row.latestLabel.concern}”: {row.latestLabel.matched
						? 'matched'
						: 'no match'}. {row.latestLabel.reason}
					{#if row.latestLabel.categories.length > 0}
						({row.latestLabel.categories.map(categoryLabel).join(', ')})
					{/if}
				</p>
			{/if}
			<ul class="item">
				<ModerationItemRow item={row} {me} inRow fallbackId={TABLE_FOCUS.card} />
			</ul>
		</div>
	</td>
</tr>

<style lang="postcss">
	@reference "../../../../app.css";

	.detail > td {
		padding: 0;
		white-space: normal;
	}

	/* An open review keeps to the visible part of the scroll box, wherever the table is scrolled. */
	.detail-body {
		position: sticky;
		left: 0;
		width: 100cqw;
	}

	.scan-note {
		padding: var(--spacing-sm) var(--spacing-md) 0;
		overflow-wrap: anywhere;
	}

	.item {
		@apply list-none m-0 p-0;
	}
</style>
