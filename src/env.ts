import { defineEnvVars } from '@sveltejs/kit/env';

// Static values are inlined at build time (as Kit 2 static env was); the dynamic ones are read
// when the server starts. The optional dynamic variables stay `undefined` when unset, so the
// build and `check` need no database and no Redis.
export const variables = defineEnvVars({
	DDD_API_KEY: { static: true },
	TMDB_API_TOKEN: { static: true },
	PUBLIC_HANKO_API_URL: { public: true, static: true },
	PUBLIC_TMDB_API_URL: { public: true, static: true },
	PUBLIC_TMDB_IMAGE_URL: { public: true, static: true },
	REDIS_URL: { schema: (value) => value },
	DB_CONNECTION: { schema: (value) => value },
	TEST_DB_CONNECTION: { schema: (value) => value }
});
