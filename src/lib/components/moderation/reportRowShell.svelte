<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		/** The row element, so the row's submit handler can put the focus back on it. */
		root?: HTMLElement;
		/** The row's subject: a title link or an account name. */
		name: Snippet;
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
	}

	let { root = $bindable(), name, meta, children, actions, readOnly, footer }: Props = $props();
</script>

<li class="item" tabindex="-1" bind:this={root}>
	<header class="meta">
		<span class="name">{@render name()}</span>
		{@render meta?.()}
	</header>
	{@render children?.()}
	{#if readOnly}
		<p class="label">{readOnly}</p>
	{:else if actions}
		<div class="actions">{@render actions()}</div>
	{/if}
	{@render footer?.()}
</li>

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

	.actions {
		@apply flex flex-wrap;
		gap: var(--spacing-sm);
	}
</style>
