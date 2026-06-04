<script lang="ts">
	import type { TriggerTag } from '../../../routes/movie/[movieId]/ddd.server';

	interface Props {
		tags: TriggerTag[];
	}

	let { tags }: Props = $props();

	/** yes-share (0–100) used to size the vote bar. */
	function yesPct(yes: number, no: number): number {
		const total = yes + no;
		return total === 0 ? 0 : Math.round((yes / total) * 100);
	}

	// ── Desktop: single shared tooltip, positioned from the hovered row ──
	let comment = $state<string | null>(null);
	let tipX = $state(0);
	let tipY = $state(0);
	let placeAbove = $state(true);
	let tipEl = $state<HTMLDivElement | null>(null);

	// Estimated tooltip height before it is measured, used for flip math.
	const ESTIMATED_TIP_HEIGHT = 96;
	const GAP = 8;

	function show(event: { currentTarget: HTMLElement }, text: string) {
		const row = event.currentTarget;
		const rect = row.getBoundingClientRect();
		// Anchor horizontally to the row's left, vertically flip based on room above.
		const tipHeight = tipEl?.offsetHeight ?? ESTIMATED_TIP_HEIGHT;
		placeAbove = rect.top > tipHeight + GAP;
		tipX = rect.left;
		tipY = placeAbove ? rect.top - GAP : rect.bottom + GAP;
		comment = text;
	}

	function hide() {
		comment = null;
	}

	// A fixed tooltip won't track the page as it scrolls, so dismiss it instead.
	$effect(() => {
		if (comment === null) return;
		const onScrollOrResize = () => hide();
		window.addEventListener('scroll', onScrollOrResize, true);
		window.addEventListener('resize', onScrollOrResize);
		return () => {
			window.removeEventListener('scroll', onScrollOrResize, true);
			window.removeEventListener('resize', onScrollOrResize);
		};
	});

	// ── Mobile: hover/tooltips don't exist on touch, so comments expand inline.
	// Tracks which tag row is currently expanded (by topicItemId).
	let expandedId = $state<number | null>(null);

	function toggleExpand(id: number) {
		expandedId = expandedId === id ? null : id;
	}
</script>

<ul class="ddd-tags">
	<li class="ddd-header" aria-hidden="true">
		<span class="header-name">Trigger</span>
		<span class="header-cat">Category</span>
		<span class="header-bar">Community vote</span>
		<span class="header-votes">Yes / No</span>
	</li>
	{#each tags as tag (tag.topicItemId)}
		{@const yes = yesPct(tag.yesSum, tag.noSum)}
		{@const hasComment = !!tag.comment}
		{@const isExpanded = expandedId === tag.topicItemId}
		<li class="ddd-tag" class:ddd-tag--has-comment={hasComment}>
			<div class="ddd-tag-row">
				{#if hasComment}
					<!-- Desktop hover tooltip + mobile inline toggle share one trigger.
               On touch there's no hover, so the click expands the inline panel. -->
					<button
						type="button"
						class="tag-trigger"
						aria-label="{tag.doesName}. {isExpanded ? 'Hide' : 'Show'} voter comment."
						aria-expanded={isExpanded}
						onmouseenter={(e) => show(e, tag.comment!)}
						onmouseleave={hide}
						onfocus={(e) => show(e, tag.comment!)}
						onblur={hide}
						onclick={() => toggleExpand(tag.topicItemId)}
					>
						<span class="tag-name">{tag.doesName}</span>
						<i
							class="tag-comment-icon ri-chat-3-line"
							class:tag-comment-icon--active={isExpanded}
							aria-hidden="true"
						></i>
					</button>
				{:else}
					<span class="tag-name">{tag.doesName}</span>
				{/if}

				{#if tag.category}
					<span class="tag-category"><span class="tag-category-pill">{tag.category}</span></span>
				{:else}
					<span class="tag-category"></span>
				{/if}

				<span class="tag-meter">
					<span class="tag-bar" role="img" aria-label="{yes}% voted yes">
						<span class="tag-bar-yes" style="width: {yes}%"></span>
					</span>
					<span class="tag-pct tabular-nums">{yes}%</span>
				</span>
				<span class="tag-votes">
					<span class="vote-yes">{tag.yesSum.toLocaleString()}</span>
					<span class="vote-sep">/</span>
					<span class="vote-no">{tag.noSum.toLocaleString()}</span>
				</span>
			</div>

			<!-- Mobile-only inline comment, revealed by tapping the row -->
			{#if hasComment && isExpanded}
				<p class="tag-comment-inline">{tag.comment}</p>
			{/if}
		</li>
	{/each}
</ul>

<!-- Desktop: one fixed tooltip for the whole list; pointer-events:none so it never flickers -->
<div
	bind:this={tipEl}
	class="ddd-tooltip"
	class:ddd-tooltip--visible={comment !== null}
	class:ddd-tooltip--below={!placeAbove}
	role="tooltip"
	style="left: {tipX}px; top: {tipY}px;"
>
	{comment}
</div>

<style lang="postcss">
	@reference "../../../app.css";

	.ddd-tags {
		@apply flex flex-col list-none m-0 p-0 overflow-hidden rounded-lg border border-border;
		background-color: var(--surface-raised);
	}

	/* Shared column geometry for header + rows */
	.ddd-header,
	.ddd-tag-row {
		@apply grid items-center gap-md;
		grid-template-columns: minmax(0, 1fr) 8rem minmax(7rem, 12rem) 5.5rem;
	}

	.ddd-header {
		@apply px-md py-sm;
		background-color: color-mix(in oklab, var(--brand) 4%, var(--surface-raised));
		border-bottom: 1px solid var(--border);
	}

	.header-name,
	.header-cat,
	.header-bar,
	.header-votes {
		@apply text-xs tracking-wide text-ink-muted;
		font-variant-caps: all-small-caps;
		letter-spacing: 0.04em;
	}

	.header-votes {
		@apply text-right;
	}

	.ddd-tag {
		@apply px-md py-sm cursor-default;
		border-bottom: 1px solid var(--border);
		transition: background-color 0.12s ease;
	}

	.ddd-tag:nth-child(even) {
		background-color: color-mix(in oklab, var(--ink) 2%, transparent);
	}

	.ddd-tag:hover {
		background-color: color-mix(in oklab, var(--brand) 6%, transparent);
	}

	.ddd-tag:last-child {
		@apply border-b-0;
	}

	/* The name cell — a button when there's a comment so it's keyboard-focusable */
	.tag-trigger {
		@apply flex items-center gap-sm min-w-0 bg-transparent border-0 p-0 m-0 text-left cursor-help;
		color: inherit;
		font: inherit;
	}

	.tag-trigger:focus-visible {
		@apply outline-none rounded-sm;
		box-shadow: 0 0 0 2px var(--brand);
	}

	.tag-name {
		@apply text-sm font-medium text-ink truncate;
	}

	.tag-comment-icon {
		@apply text-sm text-ink-muted shrink-0;
		transition: color 0.15s ease;
	}

	.tag-trigger:hover .tag-comment-icon,
	.tag-trigger:focus-visible .tag-comment-icon,
	.tag-comment-icon--active {
		color: var(--brand);
	}

	/* Category as a soft pill chip */
	.tag-category {
		@apply min-w-0;
	}

	.tag-category-pill {
		@apply inline-block max-w-full text-xs px-sm py-0 rounded-full truncate align-middle;
		line-height: 1.5;
		color: var(--ink-muted);
		background-color: color-mix(in oklab, var(--ink-muted) 12%, transparent);
	}

	/* Vote meter — a track with the "yes" share filled, plus a % label beside it */
	.tag-meter {
		@apply flex items-center gap-sm min-w-0;
	}

	.tag-bar {
		@apply relative block h-2 flex-1 rounded-full overflow-hidden;
		background-color: color-mix(in oklab, var(--success) 28%, transparent);
	}

	.tag-bar-yes {
		@apply absolute left-0 top-0 h-full rounded-full;
		background-color: var(--danger);
		transition: width 0.3s ease;
	}

	.tag-pct {
		@apply text-xs font-semibold shrink-0;
		min-width: 2.25rem;
		text-align: right;
		color: var(--ink-muted);
	}

	.tag-votes {
		@apply flex items-center justify-end gap-1 text-xs tabular-nums whitespace-nowrap;
	}

	.vote-sep {
		@apply text-ink-muted opacity-50;
	}

	.vote-yes {
		@apply font-semibold;
		color: var(--danger);
	}

	.vote-no {
		color: var(--accent);
	}

	/* Inline comment shown on mobile when a row is expanded (hidden on desktop) */
	.tag-comment-inline {
		@apply hidden text-xs leading-relaxed text-ink-muted mt-sm pl-md;
		border-left: 2px solid var(--brand);
	}

	/* ── Shared fixed tooltip (desktop hover) ── */
	.ddd-tooltip {
		@apply pointer-events-none fixed z-50 rounded-md border border-border p-sm text-xs leading-relaxed text-ink shadow-lg opacity-0;
		width: max-content;
		max-width: min(24rem, calc(100vw - 2rem));
		background-color: var(--surface-raised);
		/* default: anchored above → grow upward */
		transform: translateY(calc(-100% + 4px));
		transition:
			opacity 0.14s ease,
			transform 0.14s ease;
		will-change: opacity, transform;
	}

	.ddd-tooltip--below {
		transform: translateY(4px);
	}

	.ddd-tooltip--visible {
		@apply opacity-100;
		transform: translateY(-100%);
	}

	.ddd-tooltip--visible.ddd-tooltip--below {
		transform: translateY(0);
	}

	@media (prefers-reduced-motion: reduce) {
		.ddd-tooltip {
			transition: opacity 0.14s ease;
			transform: none;
		}
		.ddd-tooltip--visible,
		.ddd-tooltip--visible.ddd-tooltip--below {
			transform: none;
		}
	}

	/* ── Mobile: stack the row so the name gets a full line, the bar + votes
       sit below it, and comments expand inline (no hover on touch). ── */
	@media (max-width: 767px) {
		.ddd-header {
			@apply hidden;
		}

		.ddd-tag {
			@apply py-md;
		}

		/* Tapping a tag with a comment should feel obviously tappable */
		.ddd-tag--has-comment {
			@apply cursor-pointer;
		}

		/* Name on its own line; bar + votes wrap onto a second line below it.
       The name cell spans the full width to force the wrap. */
		.ddd-tag-row {
			@apply flex flex-wrap items-center gap-x-md gap-y-sm;
		}

		/* Name (and its trigger button) take the whole first line */
		.tag-trigger {
			@apply w-full justify-between cursor-pointer;
		}

		.ddd-tag-row > .tag-name {
			@apply w-full;
		}

		/* Category pill sits on its own line under the name */
		.tag-category {
			@apply w-full;
		}

		.tag-name {
			@apply whitespace-normal;
			/* override desktop truncation so long names wrap instead of clipping */
			overflow: visible;
			text-overflow: clip;
		}

		/* Meter takes the remaining width on the last line, votes sit beside it */
		.tag-meter {
			@apply flex-1;
		}

		.tag-votes {
			@apply text-sm;
		}

		/* Desktop tooltip is unreachable on touch — hide it, show inline instead */
		.ddd-tooltip {
			@apply hidden;
		}

		.tag-comment-inline {
			@apply block;
		}
	}
</style>
