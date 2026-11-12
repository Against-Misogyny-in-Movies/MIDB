import { defineConfig } from 'drizzle-kit';

// `generate` reads only the schema. The D1 HTTP driver is for the commands that talk to a
// database (`push`, `studio`) and is used only when the Cloudflare credentials are set;
// migrations are applied by `wrangler d1 migrations apply`.
const { CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_D1_DATABASE_ID, CLOUDFLARE_API_TOKEN } = process.env;
const remote = CLOUDFLARE_ACCOUNT_ID && CLOUDFLARE_D1_DATABASE_ID && CLOUDFLARE_API_TOKEN;

export default defineConfig({
	out: './db/migrations',
	schema: './db/schema/**/*.ts',
	dialect: 'sqlite',
	...(remote && {
		driver: 'd1-http' as const,
		dbCredentials: {
			accountId: CLOUDFLARE_ACCOUNT_ID,
			databaseId: CLOUDFLARE_D1_DATABASE_ID,
			token: CLOUDFLARE_API_TOKEN
		}
	})
});
