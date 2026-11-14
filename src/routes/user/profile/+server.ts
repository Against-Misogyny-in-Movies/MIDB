import { redirect } from '@sveltejs/kit';
import { requireUser } from '#lib/server/auth/guards.ts';
import { profileHref } from '#lib/media/utils/profileHref.ts';
import type { RequestHandler } from './$types';

/**
 * The account's own profile is its public page, `/u/<username>`, which shows the owner their
 * editing and private rows. This address stays as the default return path after signing in.
 * Signed out, `requireUser` sends the reader to sign in.
 */
export const GET: RequestHandler = async ({ locals }) => {
	const user = await requireUser(locals, { page: true });
	redirect(303, profileHref(user.username) ?? '/user/settings');
};
