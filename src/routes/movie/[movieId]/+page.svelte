<script lang="ts">
    import type { PageData } from "./$types";
  import MovieTile from '$lib/components/movies/tile.svelte';
  import SimpleNav from '$lib/components/navigation/simple.svelte';
  import NavItem from '$lib/components/navigation/item.svelte';

  let { data }: { data: PageData } = $props();
</script>

<MovieTile --height="400px" title={data.movie.title} date={data.movie.releaseDate} description={data.movie.overview} image={data.movie.posterPath} />
<SimpleNav>
  <NavItem href="?metrics">
    Metrics
  </NavItem>
  <NavItem href="?cast">
    Cast
  </NavItem>
</SimpleNav>
