<script lang="ts" generics="T">
	import type { Snippet } from 'svelte';

	interface Props {
		items: T[];
		/** A stable key for an item. */
		key: (item: T) => string;
		/** The row's id, so a list that grows in place can move the focus to a new row. */
		rowId?: (item: T) => string;
		/** What the card says when there are no items. */
		empty: string;
		row: Snippet<[T]>;
	}

	let { items, key, rowId, empty, row }: Props = $props();
</script>

{#if items.length === 0}
	<p class="empty">{empty}</p>
{:else}
	<ul class="rows">
		{#each items as item (key(item))}
			<li id={rowId?.(item)} tabindex="-1">
				{@render row(item)}
			</li>
		{/each}
	</ul>
{/if}

<style lang="postcss">
	@reference "../../../app.css";

	.rows {
		@apply flex flex-col list-none m-0 p-0;
	}

	.rows li {
		@apply flex flex-col;
		gap: var(--spacing-xs);
		padding: var(--spacing-md) 20px;
		border-top: 1px solid var(--border);
	}

	.empty {
		@apply text-ink-muted;
		padding: var(--spacing-md) 20px;
		border-top: 1px solid var(--border);
	}
</style>
