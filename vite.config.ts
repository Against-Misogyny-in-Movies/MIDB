import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vitest/config';
import { loadEnv } from 'vite';
import { svelteTesting } from '@testing-library/svelte/vite';

export default defineConfig(({ mode }) => {
	const env = loadEnv(mode, process.cwd(), '');
	return {
		plugins: [tailwindcss(), sveltekit(), svelteTesting()],
		define: {
			'process.env.DB_CONNECTION': JSON.stringify(env.DB_CONNECTION ?? ''),
		},
		test: {
			include: ['src/**/*.{test,spec}.{js,ts}'],
			globals: true,
			environment: "jsdom"
		}
	};
});
