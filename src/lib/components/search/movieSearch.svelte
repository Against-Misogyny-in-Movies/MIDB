<script lang="ts">
	import { nanoid } from 'nanoid';
	import SearchInput from './searchInput.svelte';
	import SearchResults from './searchResults.svelte';
	import { MovieSearchState } from './movieSearch.svelte.js';

	const search = new MovieSearchState();
	const listboxId = nanoid();

	let root = $state<HTMLElement | null>(null);

	$effect(() => search.connect());

	function onWindowPointerDown(event: PointerEvent) {
		if (root && !root.contains(event.target as Node)) {
			search.close();
		}
	}
</script>

<svelte:window onpointerdown={onWindowPointerDown} />

<div class="root" bind:this={root}>
	<SearchInput
		value={search.query}
		{listboxId}
		expanded={search.results.length > 0}
		loading={search.loading}
		activeDescendant={search.activeId}
		oninput={(q) => search.search(q)}
		onkeydown={(e) => search.handleKeydown(e)}
		onfocus={() => search.reopen()}
	/>

	{#if search.isOpen}
		<SearchResults
			id={listboxId}
			results={search.results}
			activeIndex={search.activeIndex}
			loading={search.loading}
			onhighlight={(i) => search.highlight(i)}
			onselect={(movie) => search.select(movie)}
		/>
	{/if}
</div>

<style lang="postcss">
	@reference "../../../app.css";

	.root {
		@apply relative w-full;
	}
</style>
