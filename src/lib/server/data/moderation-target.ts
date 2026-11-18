import { desc, eq, sql, type SQL } from 'drizzle-orm';
import { db } from '#lib/server/db.ts';
import { users } from '#db/schema/auth.ts';
import { moderationActions } from '#db/schema/community.ts';
import { canActOn, type TargetAction } from '#lib/media/utils/canActOn.ts';
import type { UserRow } from './user-queries.ts';

type Refusal = 'not-found' | 'forbidden-target';

/**
 * The target account when the actor may act on it (`canActOn`: an administrator on any account,
 * a moderator on ordinary accounts only; no one mutes or bans themselves), otherwise why not.
 * `action` is `restrict` for a mute or a ban, which also refuse an account that is already
 * banned (`already-banned`): a ban has nothing to add, and a muted banned account gains nothing.
 */
export function targetAllowed(actor: UserRow, targetId: string): Promise<UserRow | Refusal>;
export function targetAllowed(
	actor: UserRow,
	targetId: string,
	action: TargetAction
): Promise<UserRow | Refusal | 'already-banned'>;
export async function targetAllowed(
	actor: UserRow,
	targetId: string,
	action: TargetAction = 'moderate'
): Promise<UserRow | Refusal | 'already-banned'> {
	const [target] = await db.select().from(users).where(eq(users.id, targetId));
	if (!target || target.deletedAt) return 'not-found';
	if (!canActOn(actor, target, action)) return 'forbidden-target';
	return action === 'restrict' && target.bannedAt ? 'already-banned' : target;
}

/**
 * Whether an administrator took the latest logged moderation action on the comment. A
 * moderator may not approve, hide, reject or restore such a comment or dismiss its reports, so
 * an administrator's decision binds them.
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

/**
 * The same rule as `lastActionByAdministrator`, as a condition for the statements of one batch:
 * it holds while the latest logged action on the comment, not counting the batch's own log row
 * (`ownLogId`, which an earlier statement of the batch has already written), was not an
 * administrator's. A moderator's batch carries it, so an administrator who acts between the
 * moderator's read and the batch makes every statement a no-op instead of being overridden.
 */
export function notBoundByAdministrator(commentId: string, ownLogId: string): SQL {
	return sql`NOT EXISTS (
		SELECT 1 FROM ${moderationActions} AS a INNER JOIN ${users} AS u ON u.id = a.actor_id
		WHERE a.target_comment_id = ${commentId} AND a.id <> ${ownLogId} AND u.role = 'administrator'
			AND NOT EXISTS (
				SELECT 1 FROM ${moderationActions} AS n
				WHERE n.target_comment_id = ${commentId} AND n.id <> ${ownLogId}
					AND (n.created_at > a.created_at OR (n.created_at = a.created_at AND n.id > a.id))
			)
	)`;
}
