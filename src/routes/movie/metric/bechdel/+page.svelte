<script lang="ts">
	import Button from "$lib/components/form/button.svelte";
import CheckboxTile from "$lib/components/form/checkboxTile.svelte";
	import MetricsFrame from "$lib/components/frames/metricsFrame.svelte";
import ProcessTileGrid from "$lib/components/tiles/processTileGrid.svelte";


    let processBarGrid: ProcessTileGrid;

</script>
<MetricsFrame previous="Metrics" previousHref="/movie/metric">
    <form method="post" on:reset={() => processBarGrid.reset()}>
        <ProcessTileGrid bind:this={processBarGrid}>
            <CheckboxTile
                title="At least two women"
                short="The movie has to have at least two women in it"
                name="1"
            />
            <CheckboxTile
                title="Who talk to each other"
                short="The two woman in the movie have to talk to each other"
                name="2"
            />
            <CheckboxTile
                title="Not about man"
                short="They have to talk about something other then a man"
                name="3"
            />
        </ProcessTileGrid>
        <div class="button-group">
            <Button status="danger" type="submit" formaction="?/failed">Failed Everything!</Button>
            <Button type="submit" formaction="?/finish">Finish!</Button>
        </div>
    </form>
</MetricsFrame>

<style lang="postcss">
    form > .button-group {
        @apply flex gap-sm justify-end;
        @apply mt-md;
    }
</style>
