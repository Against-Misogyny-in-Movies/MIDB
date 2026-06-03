<script lang="ts">
  import type { PageData } from './$types';
  import DetailHeader from '$lib/components/movies/detailHeader.svelte';
  import FactGrid from '$lib/components/movies/factGrid.svelte';
  import GenderDistribution from '$lib/components/movies/genderDistribution.svelte';
  import SectionSkeleton from '$lib/components/movies/sectionSkeleton.svelte';

  let { data }: { data: PageData } = $props();
  const movie = $derived(data.movie);
</script>

<div class="movie-page">
  <section id="details">
    <DetailHeader {movie} />
    <FactGrid {movie} />
  </section>

  <section id="gender">
    <p class="label">Cast &amp; crew representation</p>
    <GenderDistribution cast={movie.cast} crew={movie.crew} />
  </section>

  <section id="metrics">
    <!-- TODO(section 3): replace with streamed metrics component -->
    <p class="label">Diversity metrics</p>
    <SectionSkeleton variant="metrics" />
  </section>

  <section id="comments">
    <!-- TODO(section 4): replace with streamed comments component -->
    <p class="label">Comments</p>
    <SectionSkeleton variant="comments" />
  </section>
</div>

<style lang="postcss">
  @reference "../../../app.css";

  .movie-page {
    @apply flex flex-col py-xl;
    gap: var(--spacing-xl);
  }

  section {
    @apply flex flex-col gap-lg;
  }
</style>
