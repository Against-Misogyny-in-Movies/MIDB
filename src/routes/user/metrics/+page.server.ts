import type { PageServerLoad } from './$types';
import { requireUser } from '#lib/server/auth/guards.ts';
import { activeMute } from '#lib/server/data/mute.ts';
import { getUserRatings } from '#lib/server/data/user-queries.ts';

export const load: PageServerLoad = async ({ locals }) => {
	const user = await requireUser(locals, { page: true });
	return {
		ratings: await getUserRatings(user.id),
		// The page is private, so the account's own mute may be named on it.
		banned: user.bannedAt !== null,
		mutedUntil: activeMute(user.mutedUntil)
	};
};
