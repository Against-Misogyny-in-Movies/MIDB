<script lang="ts">
  import { toneTokens, type VerdictTone } from '$lib/media/utils/verdict';

  type Tier = { label: string; icon: string; tone: VerdictTone };

  // Mirrors SAFETY_META / REP_META in verdict.ts (kept in sync by hand).
  const safety: Tier[] = [
    { label: 'Safer to watch', icon: 'ri-shield-check-line', tone: 'success' },
    { label: 'Watch with caution', icon: 'ri-error-warning-line', tone: 'warn' },
    { label: 'Harmful content', icon: 'ri-alert-line', tone: 'danger' },
    { label: 'Not enough data', icon: 'ri-question-line', tone: 'neutral' }
  ];

  const representation: Tier[] = [
    { label: 'Strong representation', icon: 'ri-women-line', tone: 'success' },
    { label: 'Mixed representation', icon: 'ri-scales-3-line', tone: 'warn' },
    { label: 'Poor representation', icon: 'ri-user-unfollow-line', tone: 'danger' },
    { label: 'Not enough data', icon: 'ri-question-line', tone: 'neutral' }
  ];

  function style(tone: VerdictTone): string {
    const t = toneTokens(tone);
    return `--tier-fg:var(${t.fg});`;
  }
</script>

<div class="legend">
  <div class="legend-group">
    <p class="label legend-label">Content safety</p>
    <ul class="tiers">
      {#each safety as tier (tier.label)}
        <li class="tier" style={style(tier.tone)}>
          <span class="tier-marker" aria-hidden="true"><i class={tier.icon}></i></span>
          <span class="tier-label">{tier.label}</span>
        </li>
      {/each}
    </ul>
  </div>

  <div class="legend-group">
    <p class="label legend-label">Representation</p>
    <ul class="tiers">
      {#each representation as tier (tier.label)}
        <li class="tier" style={style(tier.tone)}>
          <span class="tier-marker" aria-hidden="true"><i class={tier.icon}></i></span>
          <span class="tier-label">{tier.label}</span>
        </li>
      {/each}
    </ul>
  </div>
</div>

<style lang="postcss">
  @reference "../../../app.css";

  .legend {
    @apply grid gap-lg;
    grid-template-columns: 1fr;
  }

  @media (min-width: 480px) {
    .legend {
      grid-template-columns: 1fr 1fr;
    }
  }

  .legend-group {
    @apply flex flex-col gap-sm;
  }

  .legend-label {
    @apply text-ink-muted;
  }

  .tiers {
    @apply flex flex-col list-none m-0 p-0;
  }

  .tier {
    @apply flex items-center gap-sm text-sm text-ink font-medium;
    padding-block: var(--spacing-xs);
  }

  /* Marker shares the 1.375rem round-marker language; tinted per tier tone. */
  .tier-marker {
    @apply flex items-center justify-center rounded-full text-xs shrink-0;
    width: 1.375rem;
    height: 1.375rem;
    background-color: color-mix(in oklab, var(--tier-fg) 16%, transparent);
    color: var(--tier-fg);
  }

  .tier-label {
    @apply leading-snug;
  }
</style>
