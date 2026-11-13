<script lang="ts">
	import AiSearchBar from '#lib/components/moderation/table/aiSearchBar.svelte';
	import BulkBar from '#lib/components/moderation/table/bulkBar.svelte';
	import ModerationTable from '#lib/components/moderation/table/moderationTable.svelte';
	import TableFilters from '#lib/components/moderation/table/tableFilters.svelte';
	import TablePager from '#lib/components/moderation/table/tablePager.svelte';
	import type { ModerationTable as Table } from '#lib/media/types/moderation.ts';
	import type { TableFilters as Filters } from '#lib/media/utils/moderationFilters.ts';

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
	const allSelected = $derived(ids.length > 0 && selected.length === ids.length);
</script>

<div class="panel">
	<AiSearchBar {aiAvailable} {ids} />
	<TableFilters {filters} />

	{#if ids.length > 0}
		<label class="all">
			<input
				type="checkbox"
				checked={allSelected}
				indeterminate={selected.length > 0 && !allSelected}
				onchange={() => (ticked = allSelected ? [] : [...ids])}
			/>
			Select all {ids.length} on this page
		</label>
	{/if}

	<ModerationTable rows={table.rows} {me} bind:selected={ticked} />

	{#if selected.length > 0}
		<BulkBar ids={selected} onclear={() => (ticked = [])} />
	{/if}
	<TablePager {filters} total={table.total} page={table.page} pageSize={table.pageSize} />
</div>

<style lang="postcss">
	@reference "../../../../app.css";

	.panel {
		@apply flex flex-col;
		gap: var(--spacing-md);
	}

	.all {
		@apply inline-flex items-center text-sm cursor-pointer self-start;
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
