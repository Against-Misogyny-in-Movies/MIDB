import { requireUser } from '$lib/server/auth/guards';
import { toPublicUser } from '$lib/server/data/user-queries';
import { PRIVATE_NO_STORE } from '$lib/server/http/cache';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals, setHeaders }) => {
	setHeaders({ 'cache-control': PRIVATE_NO_STORE });
	const user = await requireUser(locals, { page: true });
	return { me: toPublicUser(user) };
};
