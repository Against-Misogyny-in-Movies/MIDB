import { fail } from '@sveltejs/kit';
import { requireUser } from '#lib/server/auth/guards.ts';
import { realEmail } from '#lib/server/auth/placeholder-email.ts';
import { configuredProviders } from '#lib/server/auth/providers.ts';
import { rateLimit } from '#lib/server/http/rate-limit.ts';
import { isStaff } from '#lib/media/utils/staff.ts';
import { purgeProfile } from '#lib/server/http/purge-title.ts';
import { toPublicUser, updateProfile } from '#lib/server/data/user-queries.ts';
import type { Actions, PageServerLoad } from './$types';

// The page lists and edits the reader's methods through `authClient`, in the browser.
export const ssr = false;

// The one page allowed to send the email to the client; everything else uses PublicUser.
export const load: PageServerLoad = async ({ locals }) => {
	// The /user layout already makes the response private.
	const user = await requireUser(locals, { page: true });
	return { providers: configuredProviders(), email: realEmail(user) };
};

export const actions: Actions = {
	/** The username and avatar, saved from the profile's editor (`profileEditor.svelte`). */
	updateProfile: async (event) => {
		const { request, locals } = event;
		const user = await requireUser(locals);
		if (!isStaff(user.role)) await rateLimit(event, 'RL_PROFILE', { userId: user.id });
		const data = await request.formData();
		const rawUsername = data.get('username');
		// A file part is not a username: fail like any other invalid one.
		if (rawUsername !== null && typeof rawUsername !== 'string') {
			return fail(422, { error: 'username-format' });
		}
		const username = rawUsername?.trim() || undefined;
		const avatarKey = (data.get('avatarKey') as string | null) || undefined;

		if (!username && !avatarKey) {
			return fail(422, { error: 'no-changes' });
		}

		const result = await updateProfile(user.id, {
			...(username !== undefined ? { username } : {}),
			...(avatarKey !== undefined ? { avatarKey } : {})
		});

		if (!result.ok) return fail(422, { error: result.reason });
		// The public profile shows the username and the avatar; the tag is per account, so the old address is purged too.
		purgeProfile(user.id);
		return { success: true, me: toPublicUser(result.user) };
	}
};
