<script lang="ts">
  import type { Snippet } from 'svelte';

  interface Props {
    /** Short heading, e.g. "What it is", "How it works". */
    label: string;
    children: Snippet;
  }

  let { label, children }: Props = $props();
</script>

<div class="sub-block">
  <p class="label sub-label">{label}</p>
  <div class="sub-body">
    {@render children()}
  </div>
</div>

<style lang="postcss">
  @reference "../../../app.css";

  .sub-block {
    @apply flex flex-col gap-xs;
  }

  .sub-label {
    @apply text-ink-muted;
  }

  .sub-body {
    @apply text-sm text-ink leading-relaxed;
  }

  /* Prose written as plain paragraphs inside the slot */
  .sub-body :global(p) {
    @apply m-0;
  }

  .sub-body :global(p + p) {
    @apply mt-sm;
  }
</style>
