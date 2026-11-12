import { PUBLIC_ORIGIN } from '$app/env/public';
import { db } from '#lib/server/db.ts';
import { env } from '#lib/server/env.ts';
import { createAuth, type Auth } from './create-auth.ts';
import { providerCredentials } from './providers.ts';

let instance: Auth | undefined;

/**
 * The Better Auth instance, built on the first request an isolate serves and reused after.
 * Secrets come from the Worker's env at that moment, never at module load.
 */
export function getAuth(): Auth {
	return (instance ??= createAuth({
		db,
		origin: PUBLIC_ORIGIN,
		secret: env.BETTER_AUTH_SECRET || undefined,
		...providerCredentials(),
		turnstileSecret: env.TURNSTILE_SECRET_KEY || undefined
	}));
}
