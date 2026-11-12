import adapter from '@sveltejs/adapter-cloudflare';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';
import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vitest/config';
import { svelteTesting } from '@testing-library/svelte/vite';
import { fileURLToPath } from 'node:url';

export default defineConfig({
	plugins: [
		tailwindcss(),
		sveltekit({
			// style: false — let @tailwindcss/vite handle <style> blocks;
			// keeps lang="postcss" recognised by svelte-check without running
			// a separate PostCSS pass that resolves tailwindcss from the package cache.
			preprocess: vitePreprocess({ style: false }),

			// Deployed on Cloudflare Workers, configured by wrangler.jsonc.
			adapter: adapter()
		}),
		svelteTesting()
	],
	test: {
		globals: true,
		// `cloudflare:workers` exists only in the Workers runtime; specs get a stub.
		alias: {
			'cloudflare:workers': fileURLToPath(
				new URL('./src/test/cloudflare-workers.stub.ts', import.meta.url)
			)
		},
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
