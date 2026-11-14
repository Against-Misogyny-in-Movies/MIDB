import { redirect } from '@sveltejs/kit';
import { requireUser } from '#lib/server/auth/guards.ts';
import { profileHref } from '#lib/media/utils/profileHref.ts';
import type { RequestHandler } from './$types';

/** The reader's community reports, with their standing, are the reports tab of their own profile. */
export const GET: RequestHandler = async ({ locals }) => {
	const user = await requireUser(locals, { page: true });
	const href = profileHref(user.username);
	redirect(303, href ? `${href}#reports` : '/user/settings');
};
