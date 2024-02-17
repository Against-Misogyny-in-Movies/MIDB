<script lang="ts" context="module">
    import { Template, Story } from '@storybook/addon-svelte-csf';
    import Tile from "./tile.svelte"
    import { faker } from '@faker-js/faker'

    export const meta = {
        title: 'Components/Movies/Tile',
        component: Tile,
        argTypes: {
          image: { control: 'text', default: '/3MGQD4yXokufNlW1AyRXdiy7ytP.jpg' },
          description: { control: 'text', default: 'Some lorem balaf aklsdj asid ndflksjd ieaoadf description' },
          title: { control: 'text', default: 'A Movie' },
          date: { control: 'date', default: new Date() },
          small: { control: 'boolean', default: false }
        }
    }
</script>



<Template let:args>
    <Tile
      {...args}  
    />
</Template>

<Story name="movie-tile-small" args={{
    image: '/3MGQD4yXokufNlW1AyRXdiy7ytP.jpg',
    description: faker.lorem.paragraph(),
    title: 'A Movie',
    date: new Date(),
    small: true
}} />


<Story name="movie-tile-large">
  <Tile
    image='/3MGQD4yXokufNlW1AyRXdiy7ytP.jpg',
    description={faker.lorem.paragraph(13)},
    title= 'A Movie'
    date={new Date()}
    --height=500px
  />

</Story>
