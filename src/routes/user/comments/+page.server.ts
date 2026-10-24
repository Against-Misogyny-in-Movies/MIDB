import type { PageServerLoad } from './$types';
import { requireUser } from '$lib/server/auth/guards';
import { getUserComments } from '$lib/server/data/user-queries';

export const load: PageServerLoad = async ({ locals }) => {
	const user = await requireUser(locals, { page: true });
	return { comments: await getUserComments(user.id) };
};
