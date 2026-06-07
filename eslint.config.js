import tsPlugin from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';
import sveltePlugin from 'eslint-plugin-svelte';
import svelteParser from 'svelte-eslint-parser';
import prettier from 'eslint-config-prettier';

const tsRecommended = tsPlugin.configs['flat/recommended'];

export default [
  // TypeScript recommended (flat)
  ...( Array.isArray(tsRecommended) ? tsRecommended : [tsRecommended] ),

  // Svelte recommended (flat)
  ...sveltePlugin.configs['flat/recommended'],

  // Prettier disables formatting rules — must come last among rule configs
  prettier,

  // Global ignores (migrated from .eslintignore)
  {
    ignores: [
      '.svelte-kit/**',
      'build/**',
      'node_modules/**',
      'package/**',
      '.env',
      '.env.*',
      '!.env.example',
      'pnpm-lock.yaml',
      'package-lock.json',
      'yarn.lock',
      '**/*.stories.svelte',
    ],
  },

  // Global rule overrides
  {
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    },
  },

  // Base JS/TS config
  {
    files: ['**/*.{js,ts}'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        sourceType: 'module',
        ecmaVersion: 2020,
      },
      globals: {
        browser: true,
        es2017: true,
        node: true,
      },
    },
  },

  // Svelte files
  {
    files: ['**/*.svelte'],
    languageOptions: {
      parser: svelteParser,
      parserOptions: {
        parser: tsParser,
      },
    },
    rules: {
      // goto() and <a href> without resolve() is normal in SvelteKit pages/components
      'svelte/no-navigation-without-resolve': 'off',
    },
  },
];
