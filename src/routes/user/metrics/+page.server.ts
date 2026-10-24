import type { PageServerLoad } from './$types';
import { getUserSubmissions } from '$lib/server/data/user-queries';

export const load: PageServerLoad = async ({ locals }) => {
	return { submissions: await getUserSubmissions(locals.user!.id) };
};
