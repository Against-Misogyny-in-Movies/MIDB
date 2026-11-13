import { eq } from 'drizzle-orm';
import { db } from '#lib/server/db.ts';
import { users } from '#db/schema/auth.ts';
import { canActOn, type TargetAction } from '#lib/media/utils/canActOn.ts';
import type { UserRow } from './user-queries.ts';

/**
 * The target account when the actor may act on it (`canActOn`: an administrator on any account,
 * a moderator on ordinary accounts only; no one mutes or bans themselves), otherwise why not.
 * `action` is `restrict` for a mute or a ban.
 */
export async function targetAllowed(
	actor: UserRow,
	targetId: string,
	action: TargetAction = 'moderate'
): Promise<UserRow | 'not-found' | 'forbidden-target'> {
	const [target] = await db.select().from(users).where(eq(users.id, targetId));
	if (!target) return 'not-found';
	return canActOn(actor, target, action) ? target : 'forbidden-target';
}
