<script lang="ts" context="module">

    import { Template, Story } from '@storybook/addon-svelte-csf';
    import ProcessTileGridet from './processTileGrid.svelte';
    import { nanoid } from 'nanoid';
    import {faker} from '@faker-js/faker';
    import CheckboxTile from '$lib/components/form/checkboxTile.svelte';
    
    export const meta = {
        title: 'Components/Tiles',
        component: ProcessTileGridet,
        argTypes: {
            "amount of tiles": { control: 'number', default: 13, min: 1, steps: 1, },
            "detailed": false
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
    <ProcessTileGridet {...args}>
      {#each Array(args["amount of tiles"]) as _, i}
        <CheckboxTile
          icon={getRandomIcon()}
          title={faker.word.noun()}
          short={faker.lorem.sentence()}
          description={faker.lorem.paragraphs()}
          name={`checkbox-${i}`}
        ></CheckboxTile>
      {/each}
    </ProcessTileGridet>
  </Template>

  <Story name="Process Tile Grid" args={{
    "amount of tiles": 13,
  }} />


