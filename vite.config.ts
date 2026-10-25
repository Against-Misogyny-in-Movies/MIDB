import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vitest/config';
import { svelteTesting } from '@testing-library/svelte/vite';

export default defineConfig({
	plugins: [tailwindcss(), sveltekit(), svelteTesting()],
	test: {
		globals: true,
		projects: [
			{
				extends: true,
				test: {
					name: 'unit',
					include: ['src/**/*.{test,spec}.{js,ts}', 'db/**/*.spec.ts'],
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
