<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		/** The section's id, which the page's "On this page" list links to. */
		id: string;
		/** The heading's id: focus returns to it when the row that held it is gone. */
		headingId: string;
		title: string;
		/** The card's list is loading or an action is running. */
		busy?: boolean;
		children: Snippet;
	}

	let { id, headingId, title, busy = false, children }: Props = $props();
</script>

<!-- A row is one line from 30rem up and two below it, whatever its content (`settingsRow`), so
     the skeleton's rows (`--row-height`) are as tall as the loaded ones and nothing below them
     moves. Every line is 2.75rem, the touch target. -->
<section {id} class="card settings-card" aria-busy={busy} aria-labelledby={headingId}>
	<h2 id={headingId} tabindex="-1">{title}</h2>
	{@render children()}
</section>

<style lang="postcss">
	@reference "../../../app.css";

	.settings-card {
		@apply flex flex-col;
		--row-height: calc(2 * 2.75rem + 3 * var(--spacing-sm));
		gap: var(--spacing-md);
		padding: 24px;
		scroll-margin-top: 5rem;
	}

	@media (min-width: 30rem) {
		.settings-card {
			--row-height: calc(2.75rem + 2 * var(--spacing-sm));
		}
	}

	h2 {
		@apply font-semibold;
		font-size: 1.125rem;
	}

	h2:focus-visible {
		outline-offset: 2px;
	}
</style>
