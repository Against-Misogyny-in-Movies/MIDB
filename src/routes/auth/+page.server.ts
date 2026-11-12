import { configuredProviders } from '#lib/server/auth/providers.ts';
import { PRIVATE_NO_STORE } from '#lib/server/http/cache.ts';
import type { PageServerLoad } from './$types';

// The page renders in the browser; its data comes from this load.
export const ssr = false;

/**
 * Which social providers have credentials. This is deployment config, not the reader's, so
 * the load never touches the user; the response is private so the edge does not keep it.
 */
export const load: PageServerLoad = ({ setHeaders }) => {
	setHeaders({ ...PRIVATE_NO_STORE });
	return { providers: configuredProviders() };
};
