import type { PageServerLoad } from './$types';
import { requireUser } from '$lib/server/auth/guards';
import { getUserSubmissions } from '$lib/server/data/user-queries';

export const load: PageServerLoad = async ({ locals }) => {
	const user = await requireUser(locals, { page: true });
	return { submissions: await getUserSubmissions(user.id) };
};
