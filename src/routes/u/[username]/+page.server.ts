import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { profileHeaders } from '#lib/server/http/cache.ts';
import { getPublicProfile } from '#lib/server/data/profile-queries.ts';

/**
 * An account's public profile: `PUBLIC_PAGE` with the account's `Cache-Tag` (`profileHeaders`),
 * the same for every visitor, so it never reads the request's user. An address with no account,
 * a banned account and an account without a username are 404, which no cache keeps; the policy
 * is set after the lookup succeeded.
 */
export const load: PageServerLoad = async ({ params, setHeaders }) => {
	const profile = await getPublicProfile(params.username);
	if (!profile) error(404, 'Profile not found');
	setHeaders(profileHeaders(profile.id));
	return { profile };
};
