import adapter from '@sveltejs/adapter-auto';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	// style: false — let @tailwindcss/vite handle <style> blocks;
	// keeps lang="postcss" recognised by svelte-check without running
	// a separate PostCSS pass that resolves tailwindcss from bun cache.
	preprocess: vitePreprocess({ style: false }),
	kit: {
		// adapter-auto only supports some environments, see https://kit.svelte.dev/docs/adapter-auto for a list.
		// If your environment is not supported or you settled on a specific environment, switch out the adapter.
		// See https://kit.svelte.dev/docs/adapters for more information about adapters.
		adapter: adapter(),
		alias: {
			'$db/*': './db/*',
		},
	}
};

export default config;
