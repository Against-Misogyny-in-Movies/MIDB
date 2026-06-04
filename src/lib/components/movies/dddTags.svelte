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
    <span></span>
    <span class="header-yes">Yes</span>
    <span class="header-no">No</span>
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

        <span class="tag-bar" role="img" aria-label="{yes}% voted yes">
          <span class="tag-bar-yes" style="width: {yes}%"></span>
        </span>
        <span class="tag-votes">
          <span class="vote-yes">{tag.yesSum}</span> /
          <span class="vote-no">{tag.noSum}</span>
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
    @apply flex flex-col list-none m-0 p-0;
  }

  .ddd-header {
    @apply grid items-center gap-md pb-xs px-sm border-b border-border;
    grid-template-columns: minmax(0, 1fr) 6rem 4.5rem;
  }

  .header-yes,
  .header-no {
    @apply text-xs text-ink-muted;
  }

  .header-yes {
    color: var(--danger-soft);
  }

  .header-no {
    color: var(--success-soft);
  }

  .ddd-tag {
    @apply py-sm px-sm border-b border-border cursor-default;
    border-radius: 4px;
    transition: background-color 0.12s ease;
  }

  .ddd-tag-row {
    @apply grid items-center gap-md;
    grid-template-columns: minmax(0, 1fr) 6rem 4.5rem;
  }

  .ddd-tag:hover {
    background-color: color-mix(in oklab, var(--brand) 5%, transparent);
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
    @apply text-sm text-ink truncate;
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

  .tag-bar {
    @apply block h-1.5 rounded-full overflow-hidden;
    background-color: color-mix(in oklab, var(--success) 30%, transparent);
  }

  .tag-bar-yes {
    @apply block h-full rounded-full;
    background-color: var(--danger);
  }

  .tag-votes {
    @apply text-xs text-ink-muted tabular-nums whitespace-nowrap;
  }

  .vote-yes {
    @apply font-semibold;
    color: var(--danger);
  }

  .vote-no {
    color: var(--success);
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

    .tag-name {
      @apply whitespace-normal;
      /* override desktop truncation so long names wrap instead of clipping */
      overflow: visible;
      text-overflow: clip;
    }

    /* Bar takes the remaining width on the second line, votes sit beside it */
    .tag-bar {
      @apply h-2 flex-1;
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
