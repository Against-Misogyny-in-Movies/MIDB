import adapter from '@sveltejs/adapter-vercel';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	// style: false — let @tailwindcss/vite handle <style> blocks;
	// keeps lang="postcss" recognised by svelte-check without running
	// a separate PostCSS pass that resolves tailwindcss from bun cache.
	preprocess: vitePreprocess({ style: false }),
	kit: {
		// Deployed on Vercel. See https://svelte.dev/docs/kit/adapter-vercel for its options.
		adapter: adapter(),
		alias: {
			'$db/*': './db/*'
		}
	}
};

export default config;
