<script lang="ts" context="module">

  import { Story, Template } from "@storybook/addon-svelte-csf";
  import { writable } from "svelte/store";
	import Tile from "./tile.svelte";
  import TileGridet from "./tileGrid.svelte";
  import {faker} from '@faker-js/faker';
	import { nanoid } from "nanoid";

  export const meta = {
    title: 'Components/Form/Tiles',
    component: TileGridet,
    argTypes: {
      "grid-cols": { control: 'number', default: 4, min:1 , steps: 1, },
      "max-width": { control: 'text' , default: "200px"},
      "amount of tiles": { control: 'number', default: 13, min: 1, steps: 1, },
      detailed: { control: 'boolean' },
    },
    parameters: {
      layout: 'centered',
    },
  };
</script>

<script lang="ts">

  const listOfIcons = [
    'ri-dropbox-line',
    'ri-copilot-line',
    'ri-github-line',
    'ri-gitlab-line',
    'ri-flutter-line',
    'ri-tree-line',
    'ri-firefox-line',
    'ri-cake-2-line',
    'ri-knife-blood-line',
    'ri-ghost-line',
    'ri-lightbulb-flash-line',
  ]

  function getRandomIcon() {
    const max = listOfIcons.length;
    const ran = Math.floor(Math.random() * max);
    return listOfIcons[ran];
  }

</script>

<Template let:args>
  <TileGridet {...args}
    --grid-cols={args["grid-cols"]}
    --max-width={args["max-width"]}
  >
    {#each Array(args["amount of tiles"]) as _, i}
      <Tile
        icon={getRandomIcon()}
        title={faker.word.noun()}
        short={faker.lorem.sentence()}
        description={faker.lorem.paragraphs()}
        ref={nanoid()}
      ></Tile>
    {/each}
  </TileGridet>
</Template>

<Story name="Tile Grid" args={{
  "grid-cols": 3,
  "max-width": "200px",
  "amount of tiles": 13,
  detailed: true,
}}/>


<Story name="Tile Grid Multiselect" args={{
  "grid-cols": 3,
  "max-width": "200px",
  "amount of tiles": 13,
  detailed: false,
}} let:args>
  <TileGridet
    {...args}
    --grid-cols={args['grid-cols']}
    --max-width={args['max-width']}
  >
    {#each Array(args["amount of tiles"]) as _, i}
      <Tile
        icon={getRandomIcon()}
        title={faker.word.noun()}
        short={faker.lorem.sentence()}
        description={faker.lorem.paragraphs()}
        ref={nanoid()}
      ></Tile>
    {/each} 
  </TileGridet>
</Story>
