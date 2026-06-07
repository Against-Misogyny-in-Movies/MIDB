import type { StorybookConfig } from '@storybook/sveltekit';
import tailwindcss from '@tailwindcss/vite';

const config: StorybookConfig = {
	stories: ['../src/**/*.mdx', '../src/**/*.stories.@(js|jsx|mjs|ts|tsx|svelte)'],
	addons: [
		'@storybook/addon-svelte-csf'
	],
	framework: {
		name: '@storybook/sveltekit',
		options: {}
	},
	docs: {
		autodocs: 'tag'
	},
	async viteFinal(config) {
		config.plugins = [tailwindcss(), ...(config.plugins ?? [])];
		return config;
	}
};
export default config;
