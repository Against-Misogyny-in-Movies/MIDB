<script lang="ts">
	import Button from '$lib/components/form/button.svelte';

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

<form onsubmit={(e) => e.preventDefault()}>
	<input
		type="text"
		name="query"
		placeholder="Search movies & TV…"
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
	<Button type="submit" aria-label="Search">
		<span class="btn-label">Search</span>
		{#if loading}
			<i class="ri-loader-4-line spinner" aria-hidden="true"></i>
		{:else}
			<i class="ri-search-line"></i>
		{/if}
	</Button>
</form>

<style lang="postcss">
	@reference "../../../app.css";

	form {
		@apply flex flex-row bg-surface-raised rounded-md p-xs border border-border;
	}

	input {
		@apply flex-1 min-w-0;
	}

	.btn-label {
		@apply hidden;
	}

	@media (min-width: 480px) {
		.btn-label {
			@apply inline;
		}
	}

	form:focus-within {
		@apply border-brand;
	}

	input:focus {
		@apply outline-none;
	}

	.spinner {
		display: inline-block;
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
