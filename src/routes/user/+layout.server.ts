import { requireUser } from '#lib/server/auth/guards.ts';
import { toPublicUser } from '#lib/server/data/user-queries.ts';
import { PRIVATE_NO_STORE } from '#lib/server/http/cache.ts';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals, setHeaders }) => {
	setHeaders({ 'cache-control': PRIVATE_NO_STORE });
	const user = await requireUser(locals, { page: true });
	return { me: toPublicUser(user) };
};
