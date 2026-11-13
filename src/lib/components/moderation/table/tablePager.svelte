<script lang="ts">
	import type { TableFilters } from '#lib/media/utils/moderationFilters.ts';
	import { tableHref } from '#lib/media/utils/tableChips.ts';

	interface Props {
		filters: TableFilters;
		total: number;
		page: number;
		pageSize: number;
	}

	let { filters, total, page, pageSize }: Props = $props();

	const pages = $derived(Math.max(1, Math.ceil(total / pageSize)));
</script>

<nav class="pager" aria-label="Pages of comments">
	{#if page > 1}
		<a class="chip" href={tableHref({ ...filters, page: page - 1 })} rel="prev">Previous</a>
	{:else}
		<span class="chip" aria-disabled="true">Previous</span>
	{/if}
	<p class="label">
		Page <span class="num">{page}</span> of <span class="num">{pages}</span>,
		<span class="num">{total}</span>
		{total === 1 ? 'comment' : 'comments'}
	</p>
	{#if page < pages}
		<a class="chip" href={tableHref({ ...filters, page: page + 1 })} rel="next">Next</a>
	{:else}
		<span class="chip" aria-disabled="true">Next</span>
	{/if}
</nav>

<style lang="postcss">
	@reference "../../../../app.css";

	.pager {
		@apply flex flex-wrap items-center justify-center;
		gap: var(--spacing-md);
	}

	.chip[aria-disabled='true'] {
		cursor: not-allowed;
		opacity: 0.55;
	}

	.chip[aria-disabled='true']:hover {
		border-color: var(--border);
		color: var(--ink-muted);
	}
</style>
