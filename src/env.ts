import { defineEnvVars } from '@sveltejs/kit/env';

// Public values are inlined at build time. Secrets and bindings are not declared here: server
// code reads them through `#lib/server/env.ts` (the Worker's env). The optional dynamic
// variables stay `undefined` when unset, so the build and `check` need no database.
export const variables = defineEnvVars({
	PUBLIC_HANKO_API_URL: { public: true, static: true },
	PUBLIC_ORIGIN: { public: true, static: true },
	PUBLIC_TMDB_API_URL: { public: true, static: true },
	PUBLIC_TMDB_IMAGE_URL: { public: true, static: true },
	PUBLIC_TURNSTILE_SITE_KEY: { public: true, static: true },
	DB_CONNECTION: { schema: (value) => value },
	TEST_DB_CONNECTION: { schema: (value) => value }
});
