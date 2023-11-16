import type { Meta, StoryObj } from '@storybook/svelte';
import Tile from './tile.svelte';

const meta = {
  title: 'Components/Form',
  component: Tile,
  argTypes: {
    title: { control: 'text' },
    short: { control: 'text' },
    long: { control: 'boolean' },
  },
  parameters: {
    layout: 'centered',
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Detailed: Story = {
  args: {
    title: 'Bechdle Test',
    short: 'A test to mesure woman representation in movies',
    long: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed vitae qua'
},
};