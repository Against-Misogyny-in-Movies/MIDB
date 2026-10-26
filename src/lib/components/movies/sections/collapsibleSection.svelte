<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		title: string;
		/** Short status at the end of the heading row (e.g. "Rating 3/3", "No data"). */
		status?: string;
		/** `data` reads as a value; `empty` and `loading` stay muted. */
		tone?: 'data' | 'empty' | 'loading';
		/** External source, linked under the body. */
		sourceLabel?: string;
		sourceHref?: string;
		/** Internal link to the matching /resources explainer section. */
		learnHref?: string;
		learnLabel?: string;
		/** Start expanded. */
		open?: boolean;
		children: Snippet;
	}

	let {
		title,
		status,
		tone = 'data',
		sourceLabel,
		sourceHref,
		learnHref,
		learnLabel = 'How this works',
		open = true,
		children
	}: Props = $props();
</script>

<details class="section" {open}>
	<summary>
		<h2 class="display title">{title}</h2>
		{#if status}
			<span class="status status--{tone}" aria-busy={tone === 'loading' || undefined}>{status}</span
			>
		{/if}
		<i class="chevron ri-arrow-down-s-line" aria-hidden="true"></i>
	</summary>

	<div class="body">
		{@render children()}
		{#if (sourceHref && sourceLabel) || learnHref}
			<p class="links">
				{#if sourceHref && sourceLabel}
					<a class="link" href={sourceHref} target="_blank" rel="noopener noreferrer">
						Source: {sourceLabel}
					</a>
				{/if}
				{#if learnHref}
					<a class="link" href={learnHref}>{learnLabel}</a>
				{/if}
			</p>
		{/if}
	</div>
</details>

<style lang="postcss">
	@reference "../../../../app.css";

	.section {
		@apply border-t border-border;
		scroll-margin-top: var(--spacing-md);
	}

	summary {
		@apply flex items-center gap-md cursor-pointer select-none;
		padding-block: var(--spacing-md);
		list-style: none;
	}

	summary::-webkit-details-marker {
		display: none;
	}

	.title {
		@apply text-2xl flex-1 min-w-0;
	}

	.status {
		@apply text-sm shrink-0 whitespace-nowrap tabular-nums;
	}

	.status--data {
		@apply text-ink font-medium;
	}

	.status--empty,
	.status--loading {
		@apply text-ink-muted;
	}

	.chevron {
		@apply text-xl text-ink-muted shrink-0;
		transition: transform 0.15s ease;
	}

	summary:hover .chevron {
		@apply text-ink;
	}

	.section[open] .chevron {
		transform: rotate(180deg);
	}

	.body {
		@apply flex flex-col gap-md;
		padding-bottom: var(--spacing-lg);
	}

	.links {
		@apply flex flex-wrap gap-x-md gap-y-xs text-sm;
	}

	@media (prefers-reduced-motion: reduce) {
		.chevron {
			transition: none;
		}
	}
</style>
