import { and, eq, exists, inArray, isNotNull, isNull, lt, not } from 'drizzle-orm';
import type { Db } from '../client.ts';
import { accounts, passkeys, retiredUsernames, sessions, users } from '../schema/auth.ts';
import { openScriptDb } from './lib/db.ts';
import { parseTarget } from './lib/args.ts';
import { isMain } from '../../scripts/lib/is-main.ts';
import { RETIRED_USERNAME_DAYS } from '../../src/lib/media/utils/username.ts';
import { DAY_MS } from '../../src/lib/media/utils/time.ts';

/**
 * How old a user must be, with no sign-in method and no session, to count as an orphan. A
 * passkey sign-up inserts the user first and the passkey after, and D1 has no transaction
 * around the two, so a failure between them leaves a sign-up that never got its passkey. The
 * window is far longer than the two inserts take.
 */
export const ORPHAN_AFTER_MS = 60 * 60 * 1000;

/**
 * Deletes the users created more than `ORPHAN_AFTER_MS` ago that have no `account`, no
 * `passkey` and no `session`: a sign-up that never got its passkey. A user with a session is
 * kept, whatever else it lacks, and so is a scrubbed account (`deleted_at` set), which has none
 * of the three by design and whose row other readers' replies hang from. Rows that reference
 * the user go with it (`ON DELETE CASCADE`). One batch, so it applies as a unit. Returns how many were removed.
 */
export async function cleanupOrphans(db: Db, now: Date = new Date()): Promise<number> {
	const cutoff = new Date(now.getTime() - ORPHAN_AFTER_MS);
	const [removed] = await db.batch([
		db
			.delete(users)
			.where(
				and(
					lt(users.createdAt, cutoff),
					isNull(users.deletedAt),
					not(
						exists(
							db.select({ one: accounts.id }).from(accounts).where(eq(accounts.userId, users.id))
						)
					),
					not(
						exists(
							db.select({ one: passkeys.id }).from(passkeys).where(eq(passkeys.userId, users.id))
						)
					),
					not(
						exists(
							db.select({ one: sessions.id }).from(sessions).where(eq(sessions.userId, users.id))
						)
					)
				)
			)
			.returning({ id: users.id })
	]);
	return removed.length;
}

/**
 * Deletes the retired usernames of deleted accounts (`deleted_at` set) that were retired more
 * than `RETIRED_USERNAME_DAYS` ago. The name lookup already ignores a row past that age, and a
 * scrubbed account's row is never deleted, so nothing else would remove them. A live account's
 * retired names stay. Returns how many were removed.
 */
export async function cleanupRetiredUsernames(db: Db, now: Date = new Date()): Promise<number> {
	const cutoff = new Date(now.getTime() - RETIRED_USERNAME_DAYS * DAY_MS);
	const [removed] = await db.batch([
		db
			.delete(retiredUsernames)
			.where(
				and(
					lt(retiredUsernames.retiredAt, cutoff),
					inArray(
						retiredUsernames.userId,
						db.select({ id: users.id }).from(users).where(isNotNull(users.deletedAt))
					)
				)
			)
			.returning({ username: retiredUsernames.username })
	]);
	return removed.length;
}

if (isMain(import.meta.url)) {
	const { db, close } = await openScriptDb(parseTarget(process.argv.slice(2)));
	try {
		const removed = await cleanupOrphans(db);
		console.log(`Removed ${removed} orphan ${removed === 1 ? 'user' : 'users'}.`);
		const names = await cleanupRetiredUsernames(db);
		console.log(`Removed ${names} expired retired ${names === 1 ? 'username' : 'usernames'}.`);
	} finally {
		await close();
	}
}
