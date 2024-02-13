<script lang="ts" context="module">

  import { Template, Story } from '@storybook/addon-svelte-csf';
  import Image from './image.svelte';

  export const meta = {
    title: 'Components/Movies/Image',
    component: Image,
    argTypes: {
      src: { control: 'text', default: 'https://via.placeholder.com/150' },
      alt: { control: 'text', default: 'A placeholder image' },
    },
    parameters: {
      layout: 'centered',
    },
  };

</script>


<script lang="ts">


</script>

<Template let:args>
  <Image {...args} />

</Template>

<Story name="Default"  >
  <Image src="uoTPjx07dxTrC1g3dYeaS2WNVGL.jpg" alt="A movie poster" />
</Story>


