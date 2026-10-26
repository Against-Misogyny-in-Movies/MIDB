<script lang="ts">
	import { SEARCH_QUERY_MAX_LENGTH } from '$lib/media/utils/search';

	interface Props {
		value: string;
		listboxId: string;
		expanded: boolean;
		loading: boolean;
		activeDescendant?: string;
		oninput: (value: string) => void;
		onkeydown: (event: KeyboardEvent) => void;
		onfocus?: () => void;
	}

	let {
		value,
		listboxId,
		expanded,
		loading,
		activeDescendant,
		oninput,
		onkeydown,
		onfocus
	}: Props = $props();
</script>

<!-- Results update as the visitor types and Enter opens the highlighted one, so the form only
     exists to give the field a search landmark; it never submits. -->
<form role="search" onsubmit={(e) => e.preventDefault()}>
	<i class="ri-search-line lead" aria-hidden="true"></i>
	<input
		type="text"
		name="query"
		placeholder="Search movies & TV…"
		aria-label="Search movies and TV"
		maxlength={SEARCH_QUERY_MAX_LENGTH}
		{value}
		oninput={(e) => oninput(e.currentTarget.value)}
		{onkeydown}
		onfocus={() => onfocus?.()}
		role="combobox"
		aria-autocomplete="list"
		aria-expanded={expanded}
		aria-controls={listboxId}
		aria-activedescendant={activeDescendant}
		autocomplete="off"
	/>
	{#if loading}
		<i class="ri-loader-4-line spinner" aria-hidden="true"></i>
	{/if}
</form>

<style lang="postcss">
	@reference "../../../app.css";

	form {
		@apply flex items-center gap-sm px-md rounded-md bg-surface-raised;
		height: 3.5rem;
		border: 1px solid var(--border-strong);
		transition:
			border-color 0.15s ease,
			box-shadow 0.15s ease;
	}

	form:hover {
		border-color: var(--ink-muted);
	}

	form:focus-within {
		border-color: var(--brand);
		box-shadow: 0 0 0 3px color-mix(in oklab, var(--brand) 18%, transparent);
	}

	.lead {
		@apply text-xl text-ink-muted shrink-0;
	}

	input {
		@apply flex-1 min-w-0 bg-transparent text-lg;
	}

	input::placeholder {
		@apply text-ink-muted;
	}

	input:focus-visible {
		@apply outline-none;
	}

	.spinner {
		@apply text-lg text-ink-muted shrink-0;
		animation: spin 0.7s linear infinite;
	}

	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.spinner {
			animation: none;
		}
	}
</style>
