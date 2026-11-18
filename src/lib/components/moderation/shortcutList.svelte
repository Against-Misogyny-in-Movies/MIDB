<script lang="ts">
	import { onMount } from 'svelte';
	import { SHORTCUT_LIST } from '#lib/media/utils/moderationKeys.ts';

	interface Props {
		onclose: () => void;
	}

	let { onclose }: Props = $props();

	let closeButton: HTMLButtonElement | undefined = $state();

	/** The list takes the focus on open, and its owner gives it back on close. */
	onMount(() => closeButton?.focus());
</script>

<!-- Not a dialog: the page behind stays usable. Escape closes it from anywhere (the page listens). -->
<section class="card list" id="shortcut-list" aria-labelledby="shortcut-heading">
	<div class="head">
		<h2 id="shortcut-heading">Keyboard shortcuts</h2>
		<button class="btn btn--ghost" type="button" bind:this={closeButton} onclick={onclose}>
			Close
		</button>
	</div>
	<dl>
		{#each SHORTCUT_LIST as { keys, does } (does)}
			<div class="pair">
				<dt>
					{#each keys as key (key)}<kbd>{key}</kbd>{/each}
				</dt>
				<dd>{does}</dd>
			</div>
		{/each}
	</dl>
	<p class="label">
		Every shortcut is also a button on the page. The keys do nothing while a field has focus or a
		modifier key is held, and the setting in the page header turns them off. Hide and Reject open
		the rule list and never act on one press.
	</p>
</section>

<style lang="postcss">
	@reference "../../../app.css";

	/* A plate under the tabs, in the flow: it covers no action of the page, and its keys wrap into columns. */
	.list {
		@apply flex flex-col;
		gap: var(--spacing-sm);
		padding: var(--spacing-md);
		scroll-margin-top: 5rem;
	}

	.head {
		@apply flex items-center justify-between;
		gap: var(--spacing-sm);
	}

	h2 {
		@apply text-lg font-semibold;
	}

	dl {
		@apply grid text-sm;
		grid-template-columns: repeat(auto-fill, minmax(16rem, 1fr));
		gap: var(--spacing-xs) var(--spacing-lg);
		margin: 0;
	}

	.pair {
		@apply grid items-center;
		grid-template-columns: 5rem minmax(0, 1fr);
		gap: var(--spacing-md);
	}

	dt {
		@apply flex flex-wrap;
		gap: var(--spacing-xs);
	}

	dd {
		margin: 0;
	}

	kbd {
		@apply inline-flex items-center justify-center text-xs font-semibold;
		min-width: 1.5rem;
		height: 1.5rem;
		padding-inline: var(--spacing-xs);
		border: 1px solid var(--border-strong);
		border-radius: 6px;
		background-color: var(--surface-sunken);
		color: var(--ink);
		font-family: inherit;
	}
</style>
