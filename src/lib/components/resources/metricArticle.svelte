<script lang="ts">
  import type { Snippet } from 'svelte';

  interface Props {
    /** Anchor id used by the in-page nav and deep links. */
    id: string;
    /** Remixicon class, e.g. "ri-scales-3-line". */
    icon: string;
    title: string;
    /** One-line summary shown as a muted subtitle under the title. */
    tagline: string;
    /** External "More info" link. */
    sourceLabel?: string;
    sourceHref?: string;
    children: Snippet;
  }

  let { id, icon, title, tagline, sourceLabel, sourceHref, children }: Props = $props();
</script>

<section {id} class="article">
  <header class="article-head">
    <span class="article-icon" aria-hidden="true"><i class={icon}></i></span>
    <div class="article-heading">
      <h2 class="title display">{title}</h2>
      <p class="tagline">{tagline}</p>
    </div>
  </header>

  <div class="article-body">
    {@render children()}

    {#if sourceHref && sourceLabel}
      <a class="source-link" href={sourceHref} target="_blank" rel="noopener noreferrer">
        {sourceLabel} <i class="ri-external-link-line" aria-hidden="true"></i>
      </a>
    {/if}
  </div>
</section>

<style lang="postcss">
  @reference "../../../app.css";

  /* Surface matches collapsibleSection.svelte for a native feel. */
  .article {
    @apply rounded-md border border-border bg-surface-raised;
    scroll-margin-top: 5rem;
  }

  .article-head {
    @apply flex items-center gap-sm p-md;
  }

  .article-heading {
    @apply flex flex-col gap-0;
    min-width: 0;
  }

  .article-icon {
    @apply flex items-center justify-center rounded-full text-lg shrink-0;
    width: 2rem;
    height: 2rem;
    background-color: color-mix(in oklab, var(--brand) 16%, transparent);
    color: var(--brand);
  }

  .title {
    @apply text-lg font-semibold text-ink;
    min-width: 0;
  }

  /* Descriptive subtitle, not a status pill — quiet muted prose under the title,
     matching the page header's .lede treatment. `pre-line` honours explicit
     newlines in the tagline while still wrapping long lines on narrow screens. */
  .tagline {
    @apply text-sm text-ink-muted leading-snug;
    white-space: pre-line;
    min-width: 0;
  }

  .article-body {
    @apply flex flex-col gap-lg px-md pb-md pt-0;
  }

  .source-link {
    @apply self-start inline-flex items-center gap-xs text-xs text-ink-muted no-underline transition-colors;
  }

  .source-link:hover {
    @apply text-brand;
  }
</style>
