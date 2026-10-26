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
		/** The Search button, and Enter with no highlighted row. */
		onsubmit: () => void;
	}

	let {
		value,
		listboxId,
		expanded,
		loading,
		activeDescendant,
		oninput,
		onkeydown,
		onfocus,
		onsubmit
	}: Props = $props();
</script>

<!-- Landing-page search bar: styled from the `.landing` palette in app.css. -->
<form
	role="search"
	onsubmit={(e) => {
		e.preventDefault();
		onsubmit();
	}}
>
	<i class="ri-search-line lead" aria-hidden="true"></i>
	<input
		type="text"
		name="query"
		placeholder="Search films and series"
		aria-label="Search films and series"
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
	<button type="submit">
		Search <i class="ri-arrow-right-line" aria-hidden="true"></i>
	</button>
</form>

<style lang="postcss">
	@reference "../../../app.css";

	form {
		@apply flex items-center gap-sm;
		padding: 4px 4px 4px 16px;
		border: 1px solid var(--l-border);
		border-radius: 12px;
		background-color: var(--l-canvas);
		box-shadow: 0 1px 2px 0 rgb(0 0 0 / 0.05);
		transition:
			border-color 0.15s ease,
			box-shadow 0.15s ease;
	}

	form:hover {
		border-color: var(--l-border-strong);
	}

	form:focus-within {
		border-color: var(--l-emerald);
		box-shadow: 0 0 0 3px rgb(5 150 105 / 0.15);
	}

	.lead,
	.spinner {
		@apply shrink-0;
		font-size: 1rem;
		color: var(--l-slate);
	}

	input {
		@apply flex-1 min-w-0 bg-transparent;
		height: 2.5rem;
		font-size: 1rem;
		color: var(--l-ink);
	}

	input::placeholder {
		color: var(--l-slate);
	}

	input:focus-visible {
		@apply outline-none;
	}

	button {
		@apply inline-flex items-center shrink-0 border-0 cursor-pointer;
		gap: 6px;
		height: 2.5rem;
		padding-inline: 16px;
		border-radius: 8px;
		font-size: 0.875rem;
		font-weight: 600;
		color: #ffffff;
		background-color: var(--l-action);
		transition:
			background-color 0.15s ease,
			box-shadow 0.15s ease;
	}

	button:hover {
		background-color: var(--l-action-hover);
		box-shadow: var(--l-shadow-action);
	}

	.spinner {
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

		form,
		button {
			transition: none;
		}
	}
</style>
