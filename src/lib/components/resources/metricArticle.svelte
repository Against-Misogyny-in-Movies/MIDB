<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		/** Anchor id used by the in-page nav and deep links. */
		id: string;
		title: string;

		/** External source link. */
		sourceLabel?: string;
		sourceHref?: string;
		children: Snippet;
	}

	let { id, title, sourceLabel, sourceHref, children }: Props = $props();
</script>

<section {id} class="article" aria-labelledby="{id}-title">
	<h2 id="{id}-title" class="display title">{title}</h2>

	{@render children()}

	{#if sourceHref && sourceLabel}
		<p class="source">
			Source: <a class="link" href={sourceHref} target="_blank" rel="noopener noreferrer"
				>{sourceLabel}</a
			>
		</p>
	{/if}
</section>

<style lang="postcss">
	@reference "../../../app.css";

	.article {
		@apply flex flex-col gap-md text-ink-muted border-t border-border;
		padding-block: var(--spacing-xl);
		scroll-margin-top: var(--spacing-md);
	}

	.article:first-child {
		@apply border-t-0 pt-0;
	}

	.title {
		@apply text-3xl text-ink;
	}

	.article :global(strong) {
		@apply font-semibold text-ink;
	}

	.source {
		@apply text-sm text-ink-muted;
	}
</style>
