<script lang="ts">
    import Button from "$lib/components/form/button.svelte";
    import CheckboxTile from "$lib/components/form/checkboxTile.svelte";
    import MetricsFrame from "$lib/components/frames/metricsFrame.svelte";
    import ProcessTileGrid from "$lib/components/tiles/processTileGrid.svelte";
    import TileGrid from "$lib/components/tiles/tileGrid.svelte";
    import TextBlock from "$lib/components/text/block.svelte";
    import type { PageData } from "./$types";

    let { data }: { data: PageData } = $props();
    let processBarGrid: ProcessTileGrid = $state()!;
</script>

<MetricsFrame previous="Metrics" previousHref="./">
    {#snippet children(detailed)}
        <h1 class="text-center">{data.name}</h1>
        <TextBlock>
            <!-- eslint-disable-next-line svelte/no-at-html-tags -->
            {@html data.description}
        </TextBlock>
        <form method="post" onreset={() => processBarGrid.reset()}>
            {#if data.hasRelatedOptions}
                <ProcessTileGrid bind:this={processBarGrid} {detailed}>
                    {#each data.options as {id, name, shortDescription} (id)}
                        <CheckboxTile
                            title={name}
                            name={id.toString()}
                            description={shortDescription}
                        />
                    {/each}
                </ProcessTileGrid>
            {:else}
                <TileGrid --grid-cols={3} --max-width="300px" {detailed}>
                    {#each data.options as {id, name, shortDescription} (id)}
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
    {/snippet}
</MetricsFrame>

<style lang="postcss">
	@reference "../../../../../app.css";
    form > .button-group {
        @apply flex gap-sm justify-end;
        @apply mt-md;
    }
</style>
