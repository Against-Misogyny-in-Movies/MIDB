<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		/** The row element, so the row's submit handler can put the focus back on it. */
		root?: HTMLElement;
		/** The row's subject: a title link or an account name. Without it the header holds only `meta`. */
		name?: Snippet;
		/** Badges, labels and the date after the name. */
		meta?: Snippet;
		/** The row's body. */
		children?: Snippet;
		/** The row's own buttons. */
		actions?: Snippet;
		/** Shown in place of the buttons when the acting staff member may not act on the row. */
		readOnly?: string;
		/** Further actions after the row's own. */
		footer?: Snippet;
		/** A class for the row element, so the list that holds it can place it. */
		class?: string;
		/** The row's id, for a link or a focus target. */
		id?: string;
		/** The element: a list item in a list, a plain block in a panel that sits in a list item of its own. */
		as?: 'li' | 'div';
		/** Leaves the header out, for a row whose subject the list above already shows. */
		headless?: boolean;
	}

	let {
		root = $bindable(),
		name,
		meta,
		children,
		actions,
		readOnly,
		footer,
		class: className,
		id,
		as = 'li',
		headless = false
	}: Props = $props();
</script>

<svelte:element this={as} class="item {className ?? ''}" {id} tabindex="-1" bind:this={root}>
	{#if !headless && (name || meta)}
		<header class="meta">
			{#if name}<span class="name">{@render name()}</span>{/if}
			{@render meta?.()}
		</header>
	{/if}
	{@render children?.()}
	{#if readOnly}
		<p class="label">{readOnly}</p>
	{:else if actions}
		<div class="action-row">{@render actions()}</div>
	{/if}
	{@render footer?.()}
</svelte:element>

<style lang="postcss">
	@reference "../../../app.css";

	.item {
		@apply flex flex-col;
		gap: var(--spacing-sm);
		padding: 16px 20px;
	}

	.meta {
		@apply flex flex-wrap items-center text-sm;
		gap: var(--spacing-xs) var(--spacing-sm);
	}

	.name {
		@apply font-semibold;
	}
</style>
