<script lang="ts">
  import type { Snippet } from 'svelte';

  interface Props {
    title: string;
    /** Short status shown on the right of the summary row (e.g. "Rating 3/3", "No data"). */
    status?: string;
    /** Tone of the status pill. */
    tone?: 'data' | 'empty' | 'loading';
    /** External source link rendered in the body header. */
    sourceLabel?: string;
    sourceHref?: string;
    /** Start expanded. Defaults to open when there is data. */
    open?: boolean;
    children: Snippet;
  }

  let {
    title,
    status,
    tone = 'data',
    sourceLabel,
    sourceHref,
    open = true,
    children
  }: Props = $props();
</script>

<details class="section" {open}>
  <summary class="summary">
    <span class="summary-main">
      <i class="chevron ri-arrow-right-s-line" aria-hidden="true"></i>
      <span class="title display">{title}</span>
    </span>
    {#if status}
      <span class="status status--{tone}">{status}</span>
    {/if}
  </summary>

  <div class="body">
    {#if sourceHref && sourceLabel}
      <a class="source-link" href={sourceHref} target="_blank" rel="noopener noreferrer">
        {sourceLabel} <i class="ri-external-link-line" aria-hidden="true"></i>
      </a>
    {/if}
    {@render children()}
  </div>
</details>

<style lang="postcss">
  @reference "../../../../app.css";

  .section {
    @apply rounded-md border border-border bg-surface-raised overflow-hidden;
    transition: border-color 0.15s ease;
  }

  .section:hover {
    border-color: color-mix(in oklab, var(--brand) 35%, var(--border));
  }

  .summary {
    @apply flex items-center justify-between gap-md p-md cursor-pointer select-none;
    list-style: none;
  }

  /* Hide the native disclosure triangle across engines */
  .summary::-webkit-details-marker {
    display: none;
  }

  .summary:focus-visible {
    @apply outline-none;
    box-shadow: inset 0 0 0 2px var(--brand);
  }

  .summary-main {
    @apply flex items-center gap-sm min-w-0;
  }

  .chevron {
    @apply text-ink-muted text-xl shrink-0;
    transition: transform 0.18s ease;
  }

  .section[open] .chevron {
    transform: rotate(90deg);
  }

  .title {
    @apply text-lg font-semibold text-ink truncate;
  }

  .status {
    @apply text-xs font-semibold px-sm py-xs rounded-full shrink-0 whitespace-nowrap;
  }

  .status--data {
    background-color: color-mix(in oklab, var(--brand) 16%, transparent);
    color: var(--brand);
  }

  .status--empty {
    background-color: var(--secondary-soft);
    color: var(--ink-muted);
  }

  .status--loading {
    background-color: var(--secondary-soft);
    color: var(--ink-muted);
  }

  .body {
    @apply flex flex-col gap-md px-md pb-md pt-0;
  }

  .source-link {
    @apply self-start inline-flex items-center gap-xs text-xs text-ink-muted no-underline transition-colors;
  }

  .source-link:hover {
    @apply text-brand;
  }
</style>
