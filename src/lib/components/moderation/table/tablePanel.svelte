<script lang="ts">
	import AiSearchBar from '#lib/components/moderation/table/aiSearchBar.svelte';
	import BulkBar from '#lib/components/moderation/table/bulkBar.svelte';
	import ModerationTable from '#lib/components/moderation/table/moderationTable.svelte';
	import TableFilters from '#lib/components/moderation/table/tableFilters.svelte';
	import TableSort from '#lib/components/moderation/table/tableSort.svelte';
	import TablePager from '#lib/components/moderation/table/tablePager.svelte';
	import type { ModerationTable as Table } from '#lib/media/types/moderation.ts';
	import { canActOn } from '#lib/media/utils/canActOn.ts';
	import type { TableFilters as Filters } from '#lib/media/utils/moderationFilters.ts';
	import { TABLE_FOCUS } from '#lib/media/utils/tableChips.ts';

	interface Props {
		table: Table;
		filters: Filters;
		aiAvailable: boolean;
		me: { id: string; role: string };
	}

	let { table, filters, aiAvailable, me }: Props = $props();

	let ticked = $state<string[]>([]);
	/** Only rows still on the page count: a filter or a reload can drop a ticked one. */
	const selected = $derived(ticked.filter((id) => table.rows.some((row) => row.comment.id === id)));
	const ids = $derived(table.rows.map((row) => row.comment.id));
	/** The rows the acting staff member may act on; the others have no checkbox to tick. */
	const selectable = $derived(
		table.rows.filter((row) => canActOn(me, row.author)).map((row) => row.comment.id)
	);
	const allSelected = $derived(selectable.length > 0 && selected.length === selectable.length);
</script>

<div class="panel">
	<AiSearchBar {aiAvailable} {ids} />
	<TableFilters {filters} />

	<div class="above">
		{#if selectable.length > 0}
			<label class="all">
				<input
					id={TABLE_FOCUS.selectAll}
					type="checkbox"
					checked={allSelected}
					indeterminate={selected.length > 0 && !allSelected}
					onchange={() => (ticked = allSelected ? [] : [...selectable])}
				/>
				Select all {selectable.length} on this page
			</label>
		{/if}
		<TableSort {filters} />
	</div>

	<ModerationTable rows={table.rows} {me} bind:selected={ticked} />

	{#if selected.length > 0}
		<BulkBar
			ids={selected}
			onclear={() => (ticked = [])}
			fallbackIds={[TABLE_FOCUS.selectAll, TABLE_FOCUS.card]}
		/>
	{/if}
	<TablePager {filters} total={table.total} page={table.page} pageSize={table.pageSize} />
</div>

<style lang="postcss">
	@reference "../../../../app.css";

	.panel {
		@apply flex flex-col;
		gap: var(--spacing-md);
	}

	.above {
		@apply flex flex-wrap items-center justify-between;
		gap: var(--spacing-sm) var(--spacing-md);
	}

	.all {
		@apply inline-flex items-center text-sm cursor-pointer;
		gap: var(--spacing-sm);
		min-height: 1.75rem;
	}

	.all input {
		width: 1rem;
		height: 1rem;
		accent-color: var(--brand);
	}

	@media (pointer: coarse) {
		.all {
			min-height: 2.75rem;
		}
	}
</style>
