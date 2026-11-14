import { redirect } from '@sveltejs/kit';
import { requireUser } from '#lib/server/auth/guards.ts';
import { profileHref } from '#lib/media/utils/profileHref.ts';
import type { RequestHandler } from './$types';

/** The reader's comments, in every status, are the Comments tab of their own profile. */
export const GET: RequestHandler = async ({ locals }) => {
	const user = await requireUser(locals, { page: true });
	redirect(303, profileHref(user.username) ?? '/user/settings');
};
