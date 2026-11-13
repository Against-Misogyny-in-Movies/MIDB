import { eq } from 'drizzle-orm';
import { db } from '#lib/server/db.ts';
import { users } from '#db/schema/auth.ts';
import type { UserRow } from './user-queries.ts';

/**
 * A moderator may act on an ordinary account; only an administrator may act on a moderator; no
 * one acts on an administrator or on themselves. It returns the target account, or why the
 * actor may not act on it.
 */
export async function targetAllowed(
	actor: UserRow,
	targetId: string
): Promise<UserRow | 'not-found' | 'forbidden-target'> {
	if (actor.id === targetId) return 'forbidden-target';
	const [target] = await db.select().from(users).where(eq(users.id, targetId));
	if (!target) return 'not-found';
	if (target.role === 'administrator') return 'forbidden-target';
	if (target.role === 'moderator' && actor.role !== 'administrator') return 'forbidden-target';
	return target;
}
