import { and, eq, exists, lt, not } from 'drizzle-orm';
import type { Db } from '../client.ts';
import { accounts, passkeys, users } from '../schema/auth.ts';
import { openScriptDb } from './lib/db.ts';
import { parseTarget } from './lib/args.ts';
import { isMain } from '../../scripts/lib/is-main.ts';

/**
 * How long a user may have no sign-in method before it counts as an orphan. A passkey sign-up
 * inserts the user first and the passkey after, and D1 has no transaction around the two, so a
 * failure between them leaves a user nobody can sign in as. An hour is far longer than the
 * two inserts take.
 */
export const ORPHAN_AFTER_MS = 60 * 60 * 1000;

/**
 * Deletes the users that have no `account` and no `passkey` and were created more than
 * `ORPHAN_AFTER_MS` ago. Their sessions and any other rows go with them (`ON DELETE CASCADE`).
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
