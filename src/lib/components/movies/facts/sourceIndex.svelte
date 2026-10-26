<script lang="ts">
	import type { SourceIndexItem } from '$lib/media/utils/sourceIndex';

	interface Props {
		items: SourceIndexItem[];
	}

	let { items }: Props = $props();
</script>

<!-- Fixed three-column (one row each on phones) list, so the DDD value streaming in replaces
     "Loading…" in place without moving anything. -->
<ul class="source-index" aria-label="Sources">
	{#each items as item (item.label)}
		<li>
			{#if item.href}
				<a class="item" href={item.href}>
					<span class="label">{item.label}</span>
					<span
						class="value num"
						class:value--empty={!item.hasData}
						aria-busy={item.busy || undefined}>{item.value}</span
					>
				</a>
			{:else}
				<span class="item">
					<span class="label">{item.label}</span>
					<span class="value value--empty">{item.value}</span>
				</span>
			{/if}
		</li>
	{/each}
</ul>

<style lang="postcss">
	@reference "../../../../app.css";

	.source-index {
		@apply grid list-none m-0 p-0 border-t border-border;
		grid-template-columns: 1fr;
	}

	@media (min-width: 560px) {
		.source-index {
			grid-template-columns: repeat(3, minmax(0, 1fr));
		}
	}

	.item {
		@apply flex justify-between gap-md no-underline py-sm;
		border-bottom: 1px solid var(--border);
	}

	@media (min-width: 560px) {
		.item {
			@apply flex-col justify-start gap-0 border-b-0;
		}
	}

	a.item .value {
		transition: color 0.15s ease;
	}

	a.item:hover .value {
		color: var(--brand);
	}

	.value {
		@apply font-medium text-ink;
	}

	.value--empty {
		@apply font-normal text-ink-muted;
	}
</style>
