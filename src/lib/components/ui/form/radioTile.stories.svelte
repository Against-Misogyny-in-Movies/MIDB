<script module>
  import { defineMeta } from '@storybook/addon-svelte-csf';
  import { faker } from '@faker-js/faker';
  import TileGrid from '$lib/components/ui/tile/tileGrid.svelte';
  import RadioTile from './radioTile.svelte';
  import Button from '$lib/components/ui/form/button.svelte';

  const { Story } = defineMeta({
    title: 'Components/Form/Tiles',
    component: RadioTile,
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

<Story name="Tile Grid One of Multi">
  {#snippet children()}
    <form onsubmit={(e) => e.preventDefault()}>
      <TileGrid --grid-cols={3} --max-width="200px">
        {#each Array(13) as _, i}
          <RadioTile
            title={faker.word.noun()}
            short={faker.lorem.sentence()}
            description={faker.lorem.paragraphs()}
            name="OneOfMulti"
            value={faker.lorem.word()}
          />
        {/each}
      </TileGrid>
      <Button type="submit">Submit</Button>
    </form>
  {/snippet}
</Story>
