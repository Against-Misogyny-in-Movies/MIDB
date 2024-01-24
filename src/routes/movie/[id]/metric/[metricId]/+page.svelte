<script lang="ts">
	import Button from "$lib/components/form/button.svelte";
    import CheckboxTile from "$lib/components/form/checkboxTile.svelte";
	import MetricsFrame from "$lib/components/frames/metricsFrame.svelte";
    import ProcessTileGrid from "$lib/components/tiles/processTileGrid.svelte";
    import TileGrid from "$lib/components/tiles/tileGrid.svelte";
    import TextBlock from "$lib/components/text/block.svelte";
	import type { PageData } from "./$types";


    export let data: PageData;
    let processBarGrid: ProcessTileGrid;

    const { name, relatedOptions, description, options } = data;
</script>
<MetricsFrame previous="Metrics" previousHref="./" let:detailed>
    <h1 class="text-center">{name}</h1>
    <TextBlock>
        {@html description}
    </TextBlock>
    <form method="post" on:reset={() => processBarGrid.reset()}>
        {#if relatedOptions}
            <ProcessTileGrid bind:this={processBarGrid} {detailed}>
                {#each options as {id, name, shortDescription}}
                    <CheckboxTile
                        title={name}
                        name={id.toString()}
                        description={shortDescription}
                    />
                {/each}
            </ProcessTileGrid>
        {:else}
            <TileGrid --grid-cols={3} --max-width="300px" {detailed}>
                {#each options as {id, name, shortDescription}}
                    <CheckboxTile
                        title={name}
                        name={id.toString()}
                        description={shortDescription}
                    />
                {/each}
            </TileGrid>
        {/if}
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
