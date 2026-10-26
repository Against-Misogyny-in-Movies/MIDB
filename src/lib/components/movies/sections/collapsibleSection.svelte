<script lang="ts">
	import type { Snippet } from 'svelte';
	import Badge from '$lib/components/ui/badge.svelte';
	import type { BadgeTone } from '$lib/media/utils/tones';

	interface Props {
		title: string;
		/** Remixicon class for the icon disk, e.g. "ri-chat-3-fill". */
		icon?: string;
		/** CSS colour for the disk, normally a source shade (`var(--src-bechdel)`). */
		hue?: string;
		/** Short status badge at the end of the heading row (e.g. "3/3", "No data"). */
		status?: string;
		tone?: BadgeTone;
		/** The status is still loading. */
		busy?: boolean;
		/** External source, linked under the body. */
		sourceLabel?: string;
		sourceHref?: string;
		/** Internal link to the matching /resources section. */
		learnHref?: string;
		learnLabel?: string;
		/** Start expanded. */
		open?: boolean;
		children: Snippet;
	}

	let {
		title,
		icon,
		hue,
		status,
		tone = 'neutral',
		busy = false,
		sourceLabel,
		sourceHref,
		learnHref,
		learnLabel = 'Methodology',
		open = true,
		children
	}: Props = $props();
</script>

<details class="card section" {open}>
	<summary>
		{#if icon}
			<span class="disk" style="--disk: 2rem; --hue: {hue ?? 'var(--brand)'}" aria-hidden="true">
				<i class={icon}></i>
			</span>
		{/if}
		<h2 class="display title">{title}</h2>
		{#if status}
			<Badge {tone} {busy}>{status}</Badge>
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
		scroll-margin-top: 5rem;
		transition: border-color 0.15s ease;
	}

	.section:hover {
		border-color: var(--border-strong);
	}

	summary {
		@apply flex items-center gap-sm cursor-pointer select-none;
		padding: 20px 24px;
		list-style: none;
	}

	summary::-webkit-details-marker {
		display: none;
	}

	summary:focus-visible {
		outline-offset: -2px;
		border-radius: 12px;
	}

	.title {
		@apply flex-1 min-w-0;
		font-size: 1.125rem;
		font-weight: 600;
		line-height: 1.33;
		margin-left: 4px;
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

	.section[open] summary {
		border-bottom: 1px solid var(--border);
	}

	.body {
		@apply flex flex-col gap-md;
		padding: 20px 24px 24px;
	}

	.links {
		@apply flex flex-wrap gap-x-md gap-y-xs text-sm;
	}

	@media (max-width: 479px) {
		summary {
			padding: 16px;
		}

		.body {
			padding: 16px;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.section,
		.chevron {
			transition: none;
		}
	}
</style>
