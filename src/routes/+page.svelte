<script lang="ts">
  import HeroSearch from '$lib/components/landing/heroSearch.svelte';
</script>

<section class="hero">
  <p class="label">A film safety reference</p>
  <h1 class="display" data-testid="hero-headline">Know before you watch.</h1>
  <p class="subhead">
    MIDB flags misogynistic content and violence against women in film —
    sourced from people and partner organisations.
  </p>
  <div class="search-wrap">
    <HeroSearch />
  </div>
  <p class="contribute">
    Seen something we missed?
    <a href="/auth" data-testid="contribute-link">Add a rating →</a>
  </p>
</section>

<section class="metrics">
  <div class="metrics-grid">
    <div>
      <h3 class="display">Bechdel Test</h3>
      <p>The seeded baseline: do two named women talk to each other about something other than a man?</p>
    </div>
    <div>
      <h3 class="display">Hybrid data</h3>
      <p>Ratings contributed by people, partner organisations, and movie metadata from TMDB.</p>
    </div>
    <div>
      <h3 class="display">Transparent marks</h3>
      <p>Each metric is explained. You see the criteria, the source, and the count behind every mark.</p>
    </div>
  </div>
</section>

<style lang="postcss">
  @reference "../app.css";

  .hero {
    @apply mt-xl mb-xl;
    max-width: 42rem;
  }

  h1 {
    @apply text-4xl font-semibold text-ink mt-sm mb-sm leading-tight;
  }

  @media (min-width: 480px) {
    h1 {
      @apply text-5xl;
    }
  }

  .subhead {
    @apply text-ink-muted text-base mb-lg;
  }

  @media (min-width: 480px) {
    .subhead {
      @apply text-lg;
    }
  }

  .search-wrap {
    @apply w-full;
    max-width: 32rem;
  }

  .contribute {
    @apply text-ink-muted mt-md text-sm;
  }

  .contribute a {
    @apply text-brand no-underline;
  }

  .contribute a:hover {
    @apply text-brand-strong;
  }

  .metrics {
    @apply border-t border-border pt-xl pb-xl;
  }

  .metrics-grid {
    @apply grid grid-cols-1 gap-lg;
  }

  @media (min-width: 768px) {
    .metrics-grid {
      @apply grid-cols-3;
    }
  }

  .metrics h3 {
    @apply text-brand font-semibold mb-xs text-lg;
  }

  .metrics p {
    @apply text-ink-muted text-sm;
  }
</style>
