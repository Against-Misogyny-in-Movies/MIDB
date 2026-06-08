<script lang="ts">
  import { UM_FLAGS } from '$lib/media/utils/metrics';
</script>

<div class="example">
  <p class="example-caption">The nine flags, with how each one reads on a title:</p>
  <ul class="um-flags">
    {#each UM_FLAGS as flag (flag.key)}
      {@const reassurance = flag.key === 'noRape'}
      <li
        class="um-flag"
        class:um-flag--reassurance={reassurance}
        class:um-flag--present={!reassurance}
      >
        <span class="flag-marker" aria-hidden="true">
          <i class={reassurance ? 'ri-check-line' : 'ri-alert-line'}></i>
        </span>
        <span class="flag-label">{flag.label}</span>
      </li>
    {/each}
  </ul>
</div>

<style lang="postcss">
  @reference "../../../app.css";

  .example {
    @apply flex flex-col gap-sm;
  }

  .example-caption {
    @apply text-sm text-ink-muted;
  }

  /* Copied from umMetricSection.svelte so the explainer matches the live section. */
  .um-flags {
    @apply grid list-none m-0 p-0;
    grid-template-columns: repeat(auto-fill, minmax(16rem, 1fr));
    gap: 0 var(--spacing-lg);
  }

  .um-flag {
    @apply flex items-center gap-sm text-sm text-ink font-medium;
    padding-block: var(--spacing-xs);
  }

  .flag-marker {
    @apply flex items-center justify-center rounded-full text-xs shrink-0;
    width: 1.375rem;
    height: 1.375rem;
    background-color: var(--secondary-soft);
    color: var(--ink-muted);
  }

  .um-flag--present .flag-marker {
    background-color: color-mix(in oklab, var(--warn) 16%, transparent);
    color: var(--warn);
  }

  .um-flag--reassurance .flag-marker {
    background-color: color-mix(in oklab, var(--success) 16%, transparent);
    color: var(--success);
  }

  .flag-label {
    @apply leading-snug;
  }
</style>
