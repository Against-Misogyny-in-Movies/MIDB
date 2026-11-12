import tsParser from '@typescript-eslint/parser';
import sveltePlugin from 'eslint-plugin-svelte';
import prettier from 'eslint-config-prettier';

// Oxlint lints TS and JS (`.oxlintrc.json`); ESLint adds `eslint-plugin-svelte` for Svelte templates and
// `.svelte` rune modules (`.svelte.ts`, `.svelte.js`). Its recommended config also covers plain `.js` files.
export default [
	// Svelte recommended (flat): the plugin's rules for `.svelte` and `.svelte.{js,ts}`, plus its `.js` base config
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
			'**/*.stories.svelte'
		]
	},

	// Svelte files and rune modules: scripts are parsed as TypeScript
	{
		files: ['**/*.svelte', '**/*.svelte.ts', '**/*.svelte.js'],
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
