<script lang="ts">
	import MovieSearch from '$lib/components/search/movieSearch.svelte';
</script>

<div class="wrap">
	<MovieSearch />
</div>

<style lang="postcss">
	@reference "../../../app.css";

	.wrap {
		@apply w-full relative;
	}

	.wrap :global(form button[type='submit']) {
		@apply bg-accent-bg text-accent-ink border-accent-bg;
	}

	.wrap :global(form button[type='submit']:hover) {
		@apply opacity-90;
	}
</style>
