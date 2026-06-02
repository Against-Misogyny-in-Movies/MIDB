<script lang="ts">
    import TileGrid from "$lib/components/tiles/tileGrid.svelte";
    import Tile from "$lib/components/tiles/tile.svelte";
    import MetricsFrame from "$lib/components/frames/metricsFrame.svelte";
    import type { PageData } from "./$types";

    let { data }: { data: PageData } = $props();
    const { movie, metrics } = data;
</script>

<MetricsFrame previous="Movie: {movie.name}" previousHref={movie.link}>
    {#snippet children(detailed)}
        <TileGrid --grid-cols={3} --max-width="300px" {detailed}>
            {#each metrics as {url, name, short} (url)}
                <Tile
                    el="a"
                    title={name}
                    description={short}
                    href={url}
                />
            {/each}
        </TileGrid>
    {/snippet}
</MetricsFrame>
