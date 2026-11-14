import { and, eq, gt, ne } from 'drizzle-orm';
import type { Db } from '#db/client.ts';
import { retiredUsernames, users } from '#db/schema/auth.ts';
import { RETIRED_USERNAME_DAYS, foldUsername } from '#lib/media/utils/username.ts';
import { DAY_MS } from '#lib/media/utils/time.ts';

/**
 * Whether `username` (lowercase) is held by an account other than `excludingId` (null for a
 * sign-up, where the account has no id yet): as its current name or a look-alike of it
 * (`foldUsername`), or as a name it retired within `RETIRED_USERNAME_DAYS`. Both reads use the
 * `username_folded` indexes. The account's own retired names do not count. It takes the
 * database so `createAuth` can run it over the one it was given.
 */
export async function isTakenByOthers(
	db: Db,
	username: string,
	excludingId: string | null
): Promise<boolean> {
	const folded = foldUsername(username);
	const cutoff = new Date(Date.now() - RETIRED_USERNAME_DAYS * DAY_MS);
	const [current, retired] = await Promise.all([
		db.query.users.findFirst({
			columns: { id: true },
			where: and(
				eq(users.usernameFolded, folded),
				excludingId === null ? undefined : ne(users.id, excludingId)
			)
		}),
		db.query.retiredUsernames.findFirst({
			columns: { username: true },
			where: and(
				eq(retiredUsernames.usernameFolded, folded),
				excludingId === null ? undefined : ne(retiredUsernames.userId, excludingId),
				gt(retiredUsernames.retiredAt, cutoff)
			)
		})
	]);
	return current !== undefined || retired !== undefined;
}
