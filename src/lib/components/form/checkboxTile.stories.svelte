<script lang="ts" context="module">

	import TileGrid from '$lib/components/tiles/tileGrid.svelte';
  import CheckboxTile from './checkboxTile.svelte';
	import { Template, Story } from '@storybook/addon-svelte-csf';
  import { faker } from '@faker-js/faker';


  export const meta = {
    title: 'Components/Form/Tiles',
    component: CheckboxTile,
    argTypes: {
      icon: { control: 'text' },
      title: { control: 'text' },
      short: { control: 'text' },
      description: { control: 'text' },
    },
    parameters: {
      layout: 'centered',
    },
  };
</script>


<script lang="ts">
  
  let selected = true;

  function handleClick() {
    console.log('clicked');
    selected = !selected;
  }
</script>



<Template let:args>
  <CheckboxTile {...args} />
</Template>

<Story name="Statefull Tile"> 
  <CheckboxTile
    icon='ri-women-line'
    title='Bechdle Test'
    name="bechdle"
    short='A test to mesure woman representation in movies'
    description='Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed vitae qua'
  />
</Story>

<Story name="Tile Grid Multiselect" args={{
  "grid-cols": 3,
  "max-width": "200px",
  "amount of tiles": 13,
  detailed: false,
}} let:args>
  <TileGrid
    {...args}
    --grid-cols={args['grid-cols']}
    --max-width={args['max-width']}
  >
    {#each Array(args["amount of tiles"]) as _, i}
      <CheckboxTile
        title={faker.word.noun()}
        short={faker.lorem.sentence()}
        description={faker.lorem.paragraphs()}
        name={faker.lorem.word()}
      ></CheckboxTile>
    {/each} 
  </TileGrid>
</Story>

