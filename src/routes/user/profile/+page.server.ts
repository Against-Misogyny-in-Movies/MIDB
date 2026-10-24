import type { PageServerLoad, Actions } from './$types';
import { fail } from '@sveltejs/kit';
import { requireUser } from '$lib/server/auth/guards';
import { toPublicUser, updateProfile } from '$lib/server/data/user-queries';

// The one page allowed to send the email to the client; everything else uses PublicUser.
export const load: PageServerLoad = async ({ locals }) => {
	const user = await requireUser(locals, { page: true });
	return { email: user.email };
};

export const actions: Actions = {
	updateProfile: async ({ request, locals }) => {
		const user = await requireUser(locals);
		const data = await request.formData();
		const username = (data.get('username') as string | null)?.trim() || undefined;
		const avatarKey = (data.get('avatarKey') as string | null) || undefined;

		if (!username && !avatarKey) {
			return fail(422, { error: 'no-changes' });
		}

		const result = await updateProfile(user.id, {
			...(username !== undefined ? { username } : {}),
			...(avatarKey !== undefined ? { avatarKey } : {})
		});

		if (!result.ok) return fail(422, { error: result.reason });
		return { success: true, me: toPublicUser(result.user) };
	}
};
