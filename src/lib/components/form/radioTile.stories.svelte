<script lang="ts" context="module">

	import TileGrid from '$lib/components/tiles/tileGrid.svelte';
  import RadioTile from './radioTile.svelte';
  import Button from '$lib/components/form/button.svelte';
	import { Template, Story } from '@storybook/addon-svelte-csf';
  import { faker } from '@faker-js/faker';
	import type { FormEventHandler } from 'svelte/elements';


  export const meta = {
    title: 'Components/Form/Tiles',
    component: RadioTile,
    argTypes: {
      icon: { control: 'text' },
      title: { control: 'text' },
      short: { control: 'text' },
      description: { control: 'text' },
      onSubmit: { action: 'submit' },
    },
    parameters: {
      layout: 'centered',
    },
  };
</script>


<script lang="ts">

  export let catchSubmit: FormEventHandler<HTMLFormElement> | undefined = undefined;
  
</script>



<Template let:args>
  <RadioTile {...args} />
</Template>

<Story name="Tile Grid One of Multi" args={{
  "grid-cols": 3,
  "max-width": "200px",
  "amount of tiles": 13,
  detailed: false,
}} let:args>
  <form on:submit|preventDefault={catchSubmit || args.onSubmit}>
    <TileGrid
      {...args}
      --grid-cols={args['grid-cols']}
      --max-width={args['max-width']}
    >
      {#each Array(args["amount of tiles"]) as _, i}
        <RadioTile
          title={faker.word.noun()}
          short={faker.lorem.sentence()}
          description={faker.lorem.paragraphs()}
          name="OneOfMulti"
          value={faker.lorem.word()}
        ></RadioTile>
      {/each}
      
    </TileGrid>
    <Button type="submit">Submit</Button>
  </form>
</Story>

