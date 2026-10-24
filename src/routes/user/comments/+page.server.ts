import type { PageServerLoad } from './$types';
import { getUserComments } from '$lib/server/data/user-queries';

export const load: PageServerLoad = async ({ locals }) => {
	return { comments: await getUserComments(locals.user!.id) };
};
