import { and, eq, exists, lt, not } from 'drizzle-orm';
import type { Db } from '../client.ts';
import { accounts, passkeys, sessions, users } from '../schema/auth.ts';
import { openScriptDb } from './lib/db.ts';
import { parseTarget } from './lib/args.ts';
import { isMain } from '../../scripts/lib/is-main.ts';

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
 * kept, whatever else it lacks. Rows that reference the user go with it (`ON DELETE CASCADE`).
 * One batch, so it applies as a unit. Returns how many were removed.
 */
export async function cleanupOrphans(db: Db, now: Date = new Date()): Promise<number> {
	const cutoff = new Date(now.getTime() - ORPHAN_AFTER_MS);
	const [removed] = await db.batch([
		db
			.delete(users)
			.where(
				and(
					lt(users.createdAt, cutoff),
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

if (isMain(import.meta.url)) {
	const { db, close } = await openScriptDb(parseTarget(process.argv.slice(2)));
	try {
		const removed = await cleanupOrphans(db);
		console.log(`Removed ${removed} orphan ${removed === 1 ? 'user' : 'users'}.`);
	} finally {
		await close();
	}
}
