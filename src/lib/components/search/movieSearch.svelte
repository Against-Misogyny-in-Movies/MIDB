<script lang="ts">
	import SearchInput from './searchInput.svelte';
	import SearchResults from './searchResults.svelte';
	import { MovieSearchState } from './movieSearch.svelte.js';

	interface Props {
		/** Pass a state to drive the field from outside (the landing page's data card does). */
		search?: MovieSearchState;
	}

	let { search = new MovieSearchState() }: Props = $props();
	const listboxId = $props.id();

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
		loading={search.loading || search.navigatingTo !== null}
		activeDescendant={search.activeId}
		oninput={(q) => search.search(q)}
		onkeydown={(e) => search.handleKeydown(e)}
		onfocus={() => search.reopen()}
		onsubmit={() => search.submit()}
	/>

	{#if search.isOpen}
		<SearchResults
			id={listboxId}
			results={search.results}
			activeIndex={search.activeIndex}
			loading={search.loading}
			navigatingTo={search.navigatingTo}
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
