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
	import { DebouncedQuery } from '$lib/media/utils/debouncedQuery.svelte.js';

	let queries = $state<string[]>([]);
	const search = new DebouncedQuery(
		(query: string) => Promise.resolve([query, ...queries]),
		(value) => (queries = value),
		{ empty: [], delayMs: 750 }
	);
</script>

<Story name="Search">
	{#snippet children()}
		<SearchForm action="#" onaction={(q) => search.push(q)} />
		{#each queries as res, i (i)}
			<p>{res}</p>
		{/each}
	{/snippet}
</Story>
