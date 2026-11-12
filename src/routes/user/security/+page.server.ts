import { requireUser } from '#lib/server/auth/guards.ts';
import { configuredProviders } from '#lib/server/auth/providers.ts';
import type { PageServerLoad } from './$types';

// The page lists and edits the reader's methods through `authClient`, in the browser.
export const ssr = false;

export const load: PageServerLoad = async ({ locals }) => {
	// The /user layout already makes the response private.
	await requireUser(locals, { page: true });
	return { providers: configuredProviders() };
};
