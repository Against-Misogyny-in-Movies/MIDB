import type { PageServerLoad } from './$types';
import { requireUser } from '#lib/server/auth/guards.ts';
import { getUserComments } from '#lib/server/data/user-queries.ts';

export const load: PageServerLoad = async ({ locals }) => {
	const user = await requireUser(locals, { page: true });
	const rows = await getUserComments(user.id);
	return {
		comments: rows.map((row) => ({
			...row,
			createdAt: row.createdAt.toISOString(),
			editedAt: row.editedAt?.toISOString() ?? null
		}))
	};
};
