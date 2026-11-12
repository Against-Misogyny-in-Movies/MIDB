import { env as workersEnv } from 'cloudflare:workers';

/**
 * Secrets, set with `wrangler secret put` in production and in `.env` locally
 * (`.env.example` lists them). Unset ones are `undefined`: a feature that needs one reads it
 * where it is used and degrades or refuses there.
 */
export interface Secrets {
	TMDB_API_TOKEN?: string;
	DDD_API_KEY?: string;
	BETTER_AUTH_SECRET?: string;
	GOOGLE_CLIENT_ID?: string;
	GOOGLE_CLIENT_SECRET?: string;
	DISCORD_CLIENT_ID?: string;
	DISCORD_CLIENT_SECRET?: string;
	ANTHROPIC_API_KEY?: string;
	TURNSTILE_SECRET_KEY?: string;
	MODERATION_EXTRA_TERMS?: string;
	/** `1` publishes comments the classifier did not check, on a localhost origin only. */
	MODERATION_DEV_AUTO_APPROVE?: string;
}

/** The Worker's bindings and vars (`wrangler.jsonc`, typed by `pnpm cf:types`) plus the secrets. */
export type ServerEnv = Cloudflare.Env & Secrets;

/**
 * The one place server code reads secrets and bindings. Read a property when a request needs
 * it, not at module load: the Worker's env belongs to the request being served. Public vars
 * the client also needs come from `$app/env/public`.
 */
export const env: ServerEnv = workersEnv;
