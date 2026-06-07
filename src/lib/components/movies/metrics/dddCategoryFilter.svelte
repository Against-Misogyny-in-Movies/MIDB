<script lang="ts">
	import type { TriggerTag } from '$lib/media/types/ddd';

	interface Props {
		tags: TriggerTag[];
		selectedCategory: string | null;
		onchange: (category: string | null) => void;
	}

	let { tags, selectedCategory, onchange }: Props = $props();

	const categories = $derived.by(() => {
		const seen = new Set<string>();
		for (const t of tags) {
			if (t.category) seen.add(t.category);
		}
		return [...seen].sort();
	});

	function handleChange(e: Event) {
		const val = (e.currentTarget as HTMLSelectElement).value;
		onchange(val === '' ? null : val);
	}
</script>

{#if categories.length > 1}
	<div class="category-filter">
		<label class="select-wrap">
			<span class="select-label label">Category</span>
			<select
				class="select"
				value={selectedCategory ?? ''}
				onchange={handleChange}
			>
				<option value="">All categories</option>
				{#each categories as cat (cat)}
					<option value={cat}>{cat}</option>
				{/each}
			</select>
		</label>
	</div>
{/if}

<style lang="postcss">
	@reference "../../../../app.css";

	.category-filter {
		@apply flex flex-col gap-xs mb-md;
	}

	.select-wrap {
		@apply flex flex-col gap-xs;
	}

	.select-label {
		@apply text-xs text-ink-muted uppercase tracking-wide;
		font-variant-caps: all-small-caps;
	}

	.select {
		@apply px-sm py-xs rounded-md border border-border bg-surface text-sm text-ink cursor-pointer;
		transition: border-color 0.15s ease;
	}

	.select:focus {
		@apply outline-none;
		border-color: var(--brand);
	}
</style>
