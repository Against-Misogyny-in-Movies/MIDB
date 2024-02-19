<script lang="ts">
	import type { PageData } from "./$types";
  import MovieTile from '$lib/components/movies/tile.svelte';
  import SimpleNav from '$lib/components/navigation/simple.svelte';
  import NavItem from '$lib/components/navigation/item.svelte';

  export let data: PageData;

  const { movie } = data;

</script>

<MovieTile --height="400px" title={movie.title} date={movie.releaseDate} description={movie.overview} image={movie.posterPath} />
<SimpleNav>
  <NavItem href="?metrics">
    Metrics
  </NavItem>
  <NavItem href="?cast">
    Cast
  </NavItem>
</SimpleNav>




