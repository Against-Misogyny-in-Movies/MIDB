<script lang="ts">
  import Image from './image.svelte';
  import { formatRuntime } from '$lib/movie/format';
  import type { Movie } from '../../../routes/movie/[movieId]/types';

  interface Props {
    movie: Movie;
  }

  let { movie }: Props = $props();

  const year = $derived(movie.releaseDate ? movie.releaseDate.slice(0, 4) : '');
  const runtime = $derived(formatRuntime(movie.runtime));
</script>

<header class="detail-header">
  <div class="poster-wrap">
    {#if movie.posterPath}
      <Image
        src={movie.posterPath}
        alt={movie.title}
        imgSizes="(max-width: 768px) 40vw, 300px"
      />
    {:else}
      <span class="poster-placeholder" aria-hidden="true">
        <i class="ri-film-line"></i>
      </span>
    {/if}
  </div>

  <div class="info">
    <h1 class="display">{movie.title}</h1>
    <p class="meta label">
      {#if year}{year}{/if}
      {#if year && runtime} · {/if}
      {#if runtime}{runtime}{/if}
      {#if movie.releaseDate}
        <span class="release-date"> · {movie.releaseDate}</span>
      {/if}
    </p>
    {#if movie.overview}
      <p class="summary">{movie.overview}</p>
    {/if}
  </div>
</header>

<style lang="postcss">
  @reference "../../../app.css";

  .detail-header {
    @apply flex flex-col gap-lg;
  }

  @media (min-width: 768px) {
    .detail-header {
      @apply flex-row items-start;
    }
  }

  .poster-wrap {
    @apply flex-shrink-0 overflow-hidden rounded-md bg-surface-raised;
    width: 200px;
    aspect-ratio: 2 / 3;
  }

  @media (min-width: 768px) {
    .poster-wrap {
      width: 300px;
    }
  }

  .poster-wrap :global(img) {
    @apply w-full h-full object-cover;
  }

  .poster-placeholder {
    @apply flex items-center justify-center w-full h-full text-ink-muted text-4xl;
  }

  .info {
    @apply flex flex-col gap-sm;
  }

  h1 {
    @apply text-4xl font-bold;
  }

  .meta {
    @apply mt-xs;
  }

  .release-date {
    @apply text-ink-muted;
  }

  .summary {
    @apply text-ink leading-relaxed mt-sm;
    max-width: 65ch;
  }
</style>
