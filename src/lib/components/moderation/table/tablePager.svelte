<script lang="ts">
	import type { TableFilters } from '#lib/media/utils/moderationFilters.ts';
	import { goto } from '$app/navigation';
	import { focusAfterUpdate } from '#lib/media/utils/focus.ts';
	import { TABLE_FOCUS, tableHref } from '#lib/media/utils/tableChips.ts';

	interface Props {
		filters: TableFilters;
		total: number;
		page: number;
		pageSize: number;
	}

	let { filters, total, page, pageSize }: Props = $props();

	const pages = $derived(Math.max(1, Math.ceil(total / pageSize)));

	/**
	 * Goes to another page and keeps the focus. The link that was used turns into plain text on
	 * the first or the last page, so the focus then moves to the table. A modified click or a
	 * middle click opens the link as a link does.
	 */
	async function go(event: MouseEvent, href: string) {
		if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
			return;
		}
		event.preventDefault();
		await goto(href, { reset: false });
		await focusAfterUpdate(() => {
			const active = document.activeElement;
			return active && active !== document.body ? null : document.getElementById(TABLE_FOCUS.card);
		});
	}
</script>

<nav class="pager" aria-label="Pages of comments">
	{#if page > 1}
		<a
			class="chip"
			href={tableHref({ ...filters, page: page - 1 })}
			rel="prev"
			onclick={(event) => go(event, tableHref({ ...filters, page: page - 1 }))}>Previous</a
		>
	{:else}
		<span class="chip" aria-disabled="true">Previous</span>
	{/if}
	<p class="label">
		Page <span class="num">{page}</span> of <span class="num">{pages}</span>,
		<span class="num">{total}</span>
		{total === 1 ? 'comment' : 'comments'}
	</p>
	{#if page < pages}
		<a
			class="chip"
			href={tableHref({ ...filters, page: page + 1 })}
			rel="next"
			onclick={(event) => go(event, tableHref({ ...filters, page: page + 1 }))}>Next</a
		>
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
