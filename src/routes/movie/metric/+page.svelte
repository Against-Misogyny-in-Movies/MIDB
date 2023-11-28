<script lang="ts">
	import TileGrid from "$lib/components/tiles/tileGrid.svelte";
    import Tile from "$lib/components/tiles/tile.svelte";
	import MetricsFrame from "$lib/components/frames/metricsFrame.svelte";
	import type { PageData } from "./$types";

    export let data: PageData;
    const { movie } = data;
</script>

<MetricsFrame previous="Movie: {movie.name}" previousHref="{movie.link}" let:detailed>
    <TileGrid --grid-cols={3} --max-width="300px" {detailed}>
        <Tile
            el="a"
            icon="ri-women-line"
            title="Bechdel Test"
            short="The Bechdel Test is a simple measure used to assess the representation of women in movies. It was popularized by American cartoonist Alison Bechdel. A movie passes the Bechdel Test if it meets the following three criteria"
            href="/movie/metric/bechdel"
        />
    </TileGrid>
</MetricsFrame>