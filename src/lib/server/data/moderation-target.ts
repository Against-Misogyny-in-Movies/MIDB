import { desc, eq } from 'drizzle-orm';
import { db } from '#lib/server/db.ts';
import { users } from '#db/schema/auth.ts';
import { moderationActions } from '#db/schema/community.ts';
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

/**
 * Whether an administrator took the latest logged moderation action on the comment. A
 * moderator may not approve, restore or dismiss the reports on such a comment, so an
 * administrator's decision binds them.
 */
export async function lastActionByAdministrator(commentId: string): Promise<boolean> {
	const [latest] = await db
		.select({ role: users.role })
		.from(moderationActions)
		.leftJoin(users, eq(moderationActions.actorId, users.id))
		.where(eq(moderationActions.targetCommentId, commentId))
		.orderBy(desc(moderationActions.createdAt), desc(moderationActions.id))
		.limit(1);
	return latest?.role === 'administrator';
}
