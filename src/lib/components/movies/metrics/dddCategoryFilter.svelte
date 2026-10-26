<script lang="ts">
	import type { TriggerTag } from '$lib/media/types/ddd';

	interface Props {
		tags: TriggerTag[];
		selectedCategory: string | null;
		onchange: (category: string | null) => void;
	}

	let { tags, selectedCategory, onchange }: Props = $props();

	const categories = $derived(
		[...new Set(tags.map((t) => t.category).filter((c): c is string => Boolean(c)))].sort()
	);

	function handleChange(e: Event) {
		const val = (e.currentTarget as HTMLSelectElement).value;
		onchange(val === '' ? null : val);
	}
</script>

{#if categories.length > 1}
	<label class="filter">
		<span class="label">Category</span>
		<select value={selectedCategory ?? ''} onchange={handleChange}>
			<option value="">All categories</option>
			{#each categories as cat (cat)}
				<option value={cat}>{cat}</option>
			{/each}
		</select>
	</label>
{/if}

<style lang="postcss">
	@reference "../../../../app.css";

	.filter {
		@apply inline-flex items-center gap-sm self-start;
	}
</style>
