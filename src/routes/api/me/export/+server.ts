import { requireUser } from '#lib/server/auth/guards.ts';
import { buildAccountExport } from '#lib/server/data/account-export.ts';
import { PRIVATE_NO_STORE } from '#lib/server/http/cache.ts';
import { rateLimit } from '#lib/server/http/rate-limit.ts';
import { isStaff } from '#lib/media/utils/staff.ts';
import type { RequestHandler } from './$types';

/** The file name's part for an account: the username, cut to letters, digits, `_` and `-`. */
function fileStem(username: string | null): string {
	return username?.replace(/[^A-Za-z0-9_-]/g, '') || 'account';
}

/**
 * The account's own data as one JSON file (`AccountExport`), sent as a download. Private and
 * never cached; 401 signed out, 429 past `RL_EXPORT`.
 */
export const GET: RequestHandler = async (event) => {
	const user = await requireUser(event.locals);
	if (!isStaff(user.role)) await rateLimit(event, 'RL_EXPORT', { userId: user.id });

	const now = new Date();
	const body = await buildAccountExport(user, now);
	const filename = `midb-data-${fileStem(user.username)}-${now.toISOString().slice(0, 10)}.json`;
	return new Response(JSON.stringify(body, null, 2), {
		headers: {
			...PRIVATE_NO_STORE,
			'content-type': 'application/json; charset=utf-8',
			'content-disposition': `attachment; filename="${filename}"`
		}
	});
};
