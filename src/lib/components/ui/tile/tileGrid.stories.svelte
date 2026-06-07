<script module>
  import { defineMeta } from '@storybook/addon-svelte-csf';
  import { faker } from '@faker-js/faker';
  import Tile from './tile.svelte';
  import CheckTile from '$lib/components/ui/form/checkboxTile.svelte';
  import TileGrid from './tileGrid.svelte';

  const listOfIcons = [
    'ri-dropbox-line', 'ri-copilot-line', 'ri-github-line', 'ri-gitlab-line',
    'ri-flutter-line', 'ri-tree-line', 'ri-firefox-line', 'ri-cake-2-line',
    'ri-knife-blood-line', 'ri-ghost-line', 'ri-lightbulb-flash-line',
  ];

  function getRandomIcon() {
    return listOfIcons[Math.floor(Math.random() * listOfIcons.length)];
  }

  const { Story } = defineMeta({
    title: 'Components/Tiles',
    component: TileGrid,
    parameters: {
      layout: 'centered',
    },
  });
</script>

<Story name="Tile Grid">
  {#snippet children()}
    <TileGrid --grid-cols={3} --max-width="200px">
      {#each Array(13) as _, i}
        <Tile
          el="a"
          href="#"
          icon={getRandomIcon()}
          title={faker.word.noun()}
          description={faker.lorem.paragraphs()}
        />
      {/each}
    </TileGrid>
  {/snippet}
</Story>

<Story name="Tile Grid Multiselect">
  {#snippet children()}
    <TileGrid --grid-cols={3} --max-width="200px" detailed={false}>
      {#each Array(13) as _, i}
        <CheckTile
          name={faker.lorem.word()}
          icon={getRandomIcon()}
          title={faker.word.noun()}
          description={faker.lorem.paragraphs()}
        />
      {/each}
    </TileGrid>
  {/snippet}
</Story>
