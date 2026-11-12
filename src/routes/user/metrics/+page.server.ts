import type { PageServerLoad } from './$types';
import { requireUser } from '#lib/server/auth/guards.ts';
import { getUserRatings } from '#lib/server/data/user-queries.ts';

export const load: PageServerLoad = async ({ locals }) => {
	const user = await requireUser(locals, { page: true });
	return { ratings: await getUserRatings(user.id) };
};
