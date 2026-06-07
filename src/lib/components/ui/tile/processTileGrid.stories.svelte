<script module>
  import { defineMeta } from '@storybook/addon-svelte-csf';
  import { faker } from '@faker-js/faker';
  import ProcessTileGrid from './processTileGrid.svelte';
  import CheckboxTile from '$lib/components/ui/form/checkboxTile.svelte';

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
    component: ProcessTileGrid,
    parameters: {
      layout: 'centered',
    },
  });
</script>

<Story name="Process Tile Grid">
  {#snippet children()}
    <ProcessTileGrid>
      {#each Array(13) as _, i}
        <CheckboxTile
          icon={getRandomIcon()}
          title={faker.word.noun()}
          description={faker.lorem.paragraphs()}
          name={`checkbox-${i}`}
        />
      {/each}
    </ProcessTileGrid>
  {/snippet}
</Story>
