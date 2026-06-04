<script module>
  import { defineMeta } from '@storybook/addon-svelte-csf';
  import Image from './image.svelte';

  const { Story } = defineMeta({
    title: 'Components/Movies/Image',
    component: Image,
    argTypes: {
      src: { control: 'text' },
      alt: { control: 'text' },
    },
    parameters: {
      layout: 'centered',
    },
  });
</script>

<Story name="Default">
  {#snippet children()}
    <Image src="uoTPjx07dxTrC1g3dYeaS2WNVGL.jpg" alt="A movie poster" />
  {/snippet}
</Story>
