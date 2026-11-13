<script lang="ts">
	import { filtersToParams, type TableFilters } from '#lib/media/utils/moderationFilters.ts';
	import { SORT_LABELS } from '#lib/media/utils/tableChips.ts';

	interface Props {
		filters: TableFilters;
	}

	let { filters }: Props = $props();

	const sorts = Object.entries(SORT_LABELS);
	/** The filters travel with the sort, so choosing a sort changes nothing else. */
	const kept = $derived([...filtersToParams({ ...filters, sort: 'newest', page: 1 })]);
</script>

<form class="sort" method="GET" data-sveltekit-reset="false">
	<input type="hidden" name="tab" value="table" />
	{#each kept as [name, value], index (index)}
		<input type="hidden" {name} {value} />
	{/each}
	<label class="field">
		<span class="label">Sort</span>
		<select
			class="input"
			name="sort"
			onchange={(event) => event.currentTarget.form?.requestSubmit()}
		>
			{#each sorts as [value, label] (value)}
				<option {value} selected={filters.sort === value}>{label}</option>
			{/each}
		</select>
	</label>
	<noscript><button class="btn btn--ink" type="submit">Sort</button></noscript>
</form>

<style lang="postcss">
	@reference "../../../../app.css";

	.sort {
		@apply flex items-center;
		gap: var(--spacing-sm);
	}

	.field {
		@apply flex items-center;
		gap: var(--spacing-sm);
	}

	.input {
		width: auto;
	}
</style>
