<script module>
  import { defineMeta } from '@storybook/addon-svelte-csf';
  import { faker } from '@faker-js/faker';
  import TileGrid from '$lib/components/tiles/tileGrid.svelte';
  import CheckboxTile from './checkboxTile.svelte';

  const { Story } = defineMeta({
    title: 'Components/Form/Tiles',
    component: CheckboxTile,
    argTypes: {
      icon: { control: 'text' },
      title: { control: 'text' },
      description: { control: 'text' },
    },
    parameters: {
      layout: 'centered',
    },
  });
</script>

<Story name="Statefull Tile">
  {#snippet children()}
    <CheckboxTile
      icon="ri-women-line"
      title="Bechdle Test"
      name="bechdle"
      description="Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed vitae qua"
    />
  {/snippet}
</Story>

<Story name="Tile Grid Multiselect">
  {#snippet children()}
    <TileGrid --grid-cols={3} --max-width="200px">
      {#each Array(13) as _, i}
        <CheckboxTile
          title={faker.word.noun()}
          description={faker.lorem.paragraphs()}
          name={faker.lorem.word()}
        />
      {/each}
    </TileGrid>
  {/snippet}
</Story>
