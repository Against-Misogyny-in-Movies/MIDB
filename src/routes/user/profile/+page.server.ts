import type { PageServerLoad, Actions } from './$types';
import { fail } from '@sveltejs/kit';
import { updateProfile, isUsernameAvailable } from '$lib/server/data/user-queries';

export const load: PageServerLoad = ({ locals }) => {
	return { user: locals.user };
};

export const actions: Actions = {
	updateProfile: async ({ request, locals }) => {
		const data = await request.formData();
		const username = (data.get('username') as string | null)?.trim() || undefined;
		const avatarKey = (data.get('avatarKey') as string | null) || undefined;

		if (!username && !avatarKey) {
			return fail(422, { error: 'no-changes' });
		}

		const result = await updateProfile(locals.user!.id, {
			...(username !== undefined ? { username } : {}),
			...(avatarKey !== undefined ? { avatarKey } : {}),
		});

		if (!result.ok) return fail(422, { error: result.reason });
		return { success: true, user: result.user };
	},
};
