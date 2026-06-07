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

	.wrap :global(form) {
		@apply p-sm;
		box-shadow: 0 6px 18px -8px color-mix(in oklab, var(--brand) 55%, transparent);
		transition:
			border-color 120ms ease-out,
			box-shadow 120ms ease-out;
	}

	.wrap :global(form:focus-within) {
		box-shadow:
			0 6px 18px -8px color-mix(in oklab, var(--brand) 55%, transparent),
			0 0 0 1px var(--brand);
	}

	.wrap :global(form input) {
		@apply text-lg px-sm;
	}

	.wrap :global(form input::placeholder) {
		@apply text-ink-muted;
	}

	.wrap :global(form button[type='submit']) {
		@apply bg-accent-bg text-accent-ink border-accent-bg font-semibold px-md;
	}

	.wrap :global(form button[type='submit']:hover) {
		@apply opacity-90;
	}
</style>
