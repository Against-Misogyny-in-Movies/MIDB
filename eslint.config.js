import tsParser from '@typescript-eslint/parser';
import sveltePlugin from 'eslint-plugin-svelte';
import prettier from 'eslint-config-prettier';

// Oxlint lints TS and JS (`.oxlintrc.json`); ESLint lints only what Oxlint cannot read: Svelte templates.
export default [
	// Svelte recommended (flat); its rules apply to `.svelte` files only
	...sveltePlugin.configs['flat/recommended'],

	// Prettier disables formatting rules: must come last among rule configs
	prettier,

	// Global ignores
	{
		ignores: [
			'.svelte-kit/**',
			'build/**',
			'.vercel/**',
			'node_modules/**',
			'package/**',
			'.claude/skills/impeccable/**',
			'**/*.stories.svelte',
			'**/*.svelte.{js,ts}'
		]
	},

	// Svelte files: scripts are parsed as TypeScript
	{
		files: ['**/*.svelte'],
		languageOptions: {
			parserOptions: {
				parser: tsParser
			}
		},
		rules: {
			// goto() and <a href> without resolve() is normal in SvelteKit pages/components
			'svelte/no-navigation-without-resolve': 'off'
		}
	}
];
