<script lang="ts" context="module">

  import Tile from './tile.svelte';
	import { Template, Story } from '@storybook/addon-svelte-csf';


  export const meta = {
    title: 'Components/Tiles',
    component: Tile,
    argTypes: {
      icon: { control: 'text' },
      title: { control: 'text' },
      short: { control: 'text' },
      description: { control: 'text' },
      selected: { control: 'boolean' },
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
  <Tile {...args} />
</Template>

<Story name="Simple Tile" args={{
  el: 'div',
  icon: 'ri-women-line',
  title: 'Bechdle Test',
  short: 'A test to mesure woman representation in movies',
  description: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed vitae qua'
}} />

<Story name="Link Tile" args={{
  el: "a",
  href: "https://bechdeltest.com/",
  icon: 'ri-women-line',
  title: 'Bechdle Test',
  short: 'A test to mesure woman representation in movies',
  description: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed vitae qua',
}} />



