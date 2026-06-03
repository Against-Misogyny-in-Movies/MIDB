<script module>
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import SearchForm from './searchForm.svelte';

	const { Story } = defineMeta({
		title: 'Components/Search/SearchForm',
		component: SearchForm,
		parameters: {
			layout: 'centered'
		}
	});
</script>

<script lang="ts">
	import { createDebouncedSearchStore } from '$lib/stores/debounced';

	const ref: { queries: string[] } = { queries: [] };
	const apiFunction = (query: string) => Promise.resolve([query, ...ref.queries]);
	const search = createDebouncedSearchStore(apiFunction, 750);
	search.subscribe((value) => {
		ref.queries = value;
	});
</script>

<Story name="Search">
	{#snippet children()}
		<SearchForm action="#" onaction={(q) => search.search(q)} />
		{#each $search as res, i (i)}
			<p>{res}</p>
		{/each}
	{/snippet}
</Story>
