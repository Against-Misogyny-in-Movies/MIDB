<script lang="ts">
	import TileGrid from "$lib/components/tiles/tileGrid.svelte";
    import Tile from "$lib/components/tiles/tile.svelte";
	import MetricsFrame from "$lib/components/frames/metricsFrame.svelte";
	import type { PageData } from "./$types";

    export let data: PageData;
    const { movie, metrics } = data;
</script>

<MetricsFrame previous="Movie: {movie.name}" previousHref="{movie.link}" let:detailed>
    <TileGrid --grid-cols={3} --max-width="300px" {detailed}>
        {#each metrics as {url, name, short}}
            <Tile
                el="a"
                title={name}
                description={short}
                href={url}
            />
        {/each}
    </TileGrid>
</MetricsFrame>