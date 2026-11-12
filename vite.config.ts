import adapter from '@sveltejs/adapter-vercel';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';
import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vitest/config';
import { svelteTesting } from '@testing-library/svelte/vite';

export default defineConfig({
	plugins: [
		tailwindcss(),
		sveltekit({
			// style: false — let @tailwindcss/vite handle <style> blocks;
			// keeps lang="postcss" recognised by svelte-check without running
			// a separate PostCSS pass that resolves tailwindcss from the package cache.
			preprocess: vitePreprocess({ style: false }),

			// Deployed on Vercel. See https://svelte.dev/docs/kit/adapter-vercel for its options.
			adapter: adapter()
		}),
		svelteTesting()
	],
	test: {
		globals: true,
		projects: [
			{
				extends: true,
				test: {
					name: 'unit',
					include: ['src/**/*.{test,spec}.{js,ts}', 'db/**/*.spec.ts', 'scripts/**/*.spec.ts'],
					exclude: ['src/**/*.db.spec.ts', 'db/**/*.db.spec.ts'],
					environment: 'jsdom'
				}
			},
			{
				// Real Postgres at TEST_DB_CONNECTION, migrated from zero once per run.
				extends: true,
				test: {
					name: 'db',
					include: ['src/**/*.db.spec.ts', 'db/**/*.db.spec.ts'],
					environment: 'node',
					fileParallelism: false,
					globalSetup: 'db/test/global-setup.ts',
					setupFiles: ['db/test/reset.ts']
				}
			}
		]
	}
});
