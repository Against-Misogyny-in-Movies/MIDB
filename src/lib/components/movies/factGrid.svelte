<script lang="ts">
  import { formatCurrency, countryName, languageName } from '$lib/movie/format';
  import type { Movie } from '../../../routes/movie/[movieId]/types';

  interface Props {
    movie: Movie;
  }

  let { movie }: Props = $props();

  const budget = $derived(formatCurrency(movie.budget));
  const revenue = $derived(formatCurrency(movie.revenue));
  const genres = $derived(movie.genres.length ? movie.genres.map((g) => g.name).join(', ') : '—');
  const countries = $derived(
    movie.originCountry.length
      ? movie.originCountry.map((c) => countryName(c)).join(', ')
      : '—'
  );
  const originalLang = $derived(
    movie.originalLanguage ? languageName(movie.originalLanguage) : '—'
  );
</script>

<dl class="fact-grid">
  <div class="fact">
    <dt class="label">Budget</dt>
    <dd>{budget}</dd>
  </div>
  <div class="fact">
    <dt class="label">Revenue</dt>
    <dd>{revenue}</dd>
  </div>
  <div class="fact">
    <dt class="label">Genres</dt>
    <dd>{genres}</dd>
  </div>
  <div class="fact">
    <dt class="label">Country</dt>
    <dd>{countries}</dd>
  </div>
  <div class="fact">
    <dt class="label">Language</dt>
    <dd>{originalLang}</dd>
  </div>
</dl>

<style lang="postcss">
  @reference "../../../app.css";

  .fact-grid {
    @apply grid gap-md;
    grid-template-columns: repeat(auto-fill, minmax(8rem, 1fr));
  }

  .fact {
    @apply flex flex-col gap-xs;
  }

  dt {
    @apply text-ink-muted;
  }

  dd {
    @apply text-ink;
  }
</style>
