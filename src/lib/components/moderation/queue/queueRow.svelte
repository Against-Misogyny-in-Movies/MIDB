<script lang="ts">
	import Badge from '#lib/components/ui/badge.svelte';
	import type { ModerationItem } from '#lib/media/types/moderation.ts';
	import { categoryLabel } from '#lib/media/utils/comments.ts';
	import { formatDate } from '#lib/media/utils/format.ts';
	import { severityTone } from '#lib/media/utils/tones.ts';

	interface Props {
		item: ModerationItem;
		/** The row whose panel is open. */
		selected: boolean;
		/** A severe comment's text stays out of the row: its categories show in its place. */
		collapsed: boolean;
		onselect: () => void;
	}

	let { item, selected, collapsed, onselect }: Props = $props();

	const reports = $derived(item.reports.length);
	const categories = $derived(item.aiCategories.map(categoryLabel).join(', '));
</script>

<button
	class="row-button"
	type="button"
	id="row-{item.comment.id}"
	aria-current={selected ? 'true' : undefined}
	onclick={onselect}
>
	<span class="why">
		{#if item.severity !== null && item.severity > 0}
			<Badge tone={severityTone(item.severity)}>Severity {item.severity}</Badge>
		{/if}
		{#if reports > 0}
			<Badge tone="neutral">{reports} open {reports === 1 ? 'report' : 'reports'}</Badge>
		{/if}
		<span class="title">{item.title.name}</span>
		<time class="label" datetime={item.comment.createdAt}>{formatDate(item.comment.createdAt)}</time
		>
	</span>
	<span class="snippet" class:collapsed>
		{#if collapsed}
			Comment collapsed{categories ? `: ${categories}.` : '.'}
		{:else}
			{item.comment.body}
		{/if}
	</span>
</button>

<style lang="postcss">
	@reference "../../../../app.css";

	.row-button {
		@apply flex flex-col w-full text-left text-sm;
		gap: var(--spacing-xs);
		padding: 12px 16px;
		border: 0;
		border-radius: 0;
		background: none;
		color: var(--ink);
		cursor: pointer;
		transition: background-color 0.15s ease;
		/* The sticky header is 4rem: a row scrolled into view stops clear of it. */
		scroll-margin-top: 5rem;
	}

	.row-button:hover {
		background-color: var(--surface-sunken);
	}

	/* The wash, a 1px brand outline and the heavier title say which row is open, so colour is not the only mark; the 2px ring says which has the keys. */
	.row-button[aria-current='true'] {
		background-color: var(--brand-wash);
		outline: 1px solid var(--brand);
		outline-offset: -1px;
	}

	.row-button[aria-current='true'] .title {
		@apply font-semibold;
	}

	.row-button:focus-visible {
		outline: 2px solid var(--brand);
		outline-offset: -2px;
	}

	.why {
		@apply flex flex-wrap items-center;
		gap: var(--spacing-xs) var(--spacing-sm);
	}

	.title {
		@apply font-medium;
		overflow-wrap: anywhere;
	}

	/* Two lines whatever the text, so the row keeps its height when a collapsed comment is shown. */
	.snippet {
		@apply line-clamp-2;
		min-height: 2.5rem;
		line-height: 1.25rem;
		overflow-wrap: anywhere;
	}

	.snippet.collapsed {
		@apply text-ink-muted;
	}

	@media (pointer: coarse) {
		.row-button {
			min-height: 2.75rem;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.row-button {
			transition: none;
		}
	}
</style>
