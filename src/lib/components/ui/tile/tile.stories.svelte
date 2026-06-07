<script module>
  import { defineMeta } from '@storybook/addon-svelte-csf';
  import Tile from './tile.svelte';

  const { Story } = defineMeta({
    title: 'Components/Tiles',
    component: Tile,
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

<Story name="Simple Tile" args={{
  el: 'div',
  icon: 'ri-women-line',
  title: 'Bechdle Test',
  description: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed vitae qua'
}} />

<Story name="Link Tile" args={{
  el: 'a',
  href: 'https://bechdeltest.com/',
  icon: 'ri-women-line',
  title: 'Bechdle Test',
  description: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed vitae qua',
}} />
