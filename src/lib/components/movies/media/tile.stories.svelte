<script module>
  import { defineMeta } from '@storybook/addon-svelte-csf';
  import { faker } from '@faker-js/faker';
  import Tile from './tile.svelte';

  const { Story } = defineMeta({
    title: 'Components/Movies/Tile',
    component: Tile,
    argTypes: {
      image: { control: 'text' },
      description: { control: 'text' },
      title: { control: 'text' },
      date: { control: 'text' },
      small: { control: 'boolean' },
    },
  });
</script>

<Story name="movie-tile-small" args={{
  image: '/3MGQD4yXokufNlW1AyRXdiy7ytP.jpg',
  description: faker.lorem.paragraph(),
  title: 'A Movie',
  date: '2024-01-15',
  small: true,
}} />

<Story name="movie-tile-large" args={{
  image: '/3MGQD4yXokufNlW1AyRXdiy7ytP.jpg',
  description: faker.lorem.paragraph(13),
  title: 'A Movie',
  date: '2024-01-15',
}} />
