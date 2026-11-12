import { env } from '#lib/server/env.ts';
import type { ConfiguredProviders } from '#lib/media/utils/auth-providers.ts';
import type { OAuthCredentials } from './create-auth.ts';

function credentials(id?: string, secret?: string): OAuthCredentials | undefined {
	return id && secret ? { clientId: id, clientSecret: secret } : undefined;
}

/** The Google and Discord credentials from the Worker's env; a provider with none is absent. */
export function providerCredentials(): { google?: OAuthCredentials; discord?: OAuthCredentials } {
	return {
		google: credentials(env.GOOGLE_CLIENT_ID, env.GOOGLE_CLIENT_SECRET),
		discord: credentials(env.DISCORD_CLIENT_ID, env.DISCORD_CLIENT_SECRET)
	};
}

/**
 * Which social buttons `/auth` shows: the flags only, never a credential. They depend on the
 * deployment, not on the request, so the page's load can return them without reading the user.
 */
export function configuredProviders(): ConfiguredProviders {
	const { google, discord } = providerCredentials();
	return { google: google !== undefined, discord: discord !== undefined };
}
