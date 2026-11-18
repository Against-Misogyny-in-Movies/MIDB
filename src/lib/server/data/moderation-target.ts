import { and, desc, eq, inArray, isNull, sql, type SQL } from 'drizzle-orm';
import { chunkForD1 } from '#db/lib/chunkForD1.ts';
import { db } from '#lib/server/db.ts';
import { users } from '#db/schema/auth.ts';
import { moderationActions, titleCountFlags } from '#db/schema/community.ts';
import { canActOn, type TargetAction } from '#lib/media/utils/canActOn.ts';
import type { UserRow } from './user-queries.ts';

type Refusal = 'not-found' | 'forbidden-target';

/**
 * The target account when the actor may act on it (`canActOn`: an administrator on any account,
 * a moderator on ordinary accounts only; no one mutes or bans themselves), otherwise why not.
 * `restrict` is a mute or a ban, which also refuse an account that is already banned
 * (`already-banned`): a ban has nothing to add, and a muted banned account gains nothing.
 * `reverse` ends a mute or lifts a ban, under the rule of `restrict`, and accepts a banned account.
 */
export function targetAllowed(
	actor: UserRow,
	targetId: string,
	action?: 'moderate' | 'reverse'
): Promise<UserRow | Refusal>;
export function targetAllowed(
	actor: UserRow,
	targetId: string,
	action: 'restrict'
): Promise<UserRow | Refusal | 'already-banned'>;
export async function targetAllowed(
	actor: UserRow,
	targetId: string,
	action: TargetAction | 'reverse' = 'moderate'
): Promise<UserRow | Refusal | 'already-banned'> {
	const [target] = await db.select().from(users).where(eq(users.id, targetId));
	if (!target || target.deletedAt) return 'not-found';
	if (!canActOn(actor, target, action === 'reverse' ? 'restrict' : action)) {
		return 'forbidden-target';
	}
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

/**
 * Whether a moderator set the latest mute logged on the account (its `mute` row's actor is a
 * moderator now). A moderator may end only such a mute; an administrator may end any. A mute
 * with no `mute` row, or one an administrator, a deleted account or a former staff member wrote,
 * is not a moderator's.
 */
export const muteSetByModerator = (userId: string): SQL => sql`(
	SELECT u.role FROM ${moderationActions} AS a LEFT JOIN ${users} AS u ON u.id = a.actor_id
	WHERE a.target_user_id = ${userId} AND a.action = 'mute'
	ORDER BY a.created_at DESC, a.id DESC LIMIT 1
) = 'moderator'`;

/**
 * Whether an administrator wrote the latest mute logged on the account. A moderator may not
 * mute an account whose active mute this holds for (`admin-acted`), since the log row it would
 * write would make the mute a moderator's to end.
 */
export const muteSetByAdministrator = (userId: string): SQL => sql`(
	SELECT u.role FROM ${moderationActions} AS a LEFT JOIN ${users} AS u ON u.id = a.actor_id
	WHERE a.target_user_id = ${userId} AND a.action = 'mute'
	ORDER BY a.created_at DESC, a.id DESC LIMIT 1
) = 'administrator'`;

/**
 * The condition of a mute or a ban's batch on the target account: it is live and not banned, and,
 * for a moderator, still an ordinary account (a promotion between the read and the batch is
 * refused). A moderator's mute also needs that no administrator's mute is in force. Every
 * statement of the batch carries it (as `EXISTS` where the statement has no `user` row of its
 * own: `onTarget`).
 */
export function restrictGuard(actor: UserRow, targetId: string, mute: boolean): SQL {
	const moderator = actor.role !== 'administrator';
	return and(
		eq(users.id, targetId),
		isNull(users.bannedAt),
		isNull(users.deletedAt),
		moderator ? eq(users.role, 'user') : undefined,
		moderator && mute
			? sql`(coalesce(${users.mutedUntil}, 0) <= ${Date.now()} OR NOT coalesce(${muteSetByAdministrator(targetId)}, 0))`
			: undefined
	) as SQL;
}

/** `guard` (a condition on `user` rows) as a condition for a statement on another table. */
export const onTarget = (guard: SQL): SQL => sql`EXISTS (SELECT 1 FROM ${users} WHERE ${guard})`;

/**
 * Whether an administrator closed the count flag the latest time (a `resolve_count_flag` or
 * `dismiss_count_flag` row for the title and the reporter), as a condition over the flag row
 * (`titleCountFlags`) of the statement it is in.
 */
export const flagClosedByAdministrator = (): SQL => sql`coalesce((
	SELECT u.role FROM ${moderationActions} AS a LEFT JOIN ${users} AS u ON u.id = a.actor_id
	WHERE a.target_title_id = ${titleCountFlags.titleId} AND a.target_user_id = ${titleCountFlags.reporterId}
		AND a.action IN ('resolve_count_flag', 'dismiss_count_flag')
	ORDER BY a.created_at DESC, a.id DESC LIMIT 1
) = 'administrator', 0)`;

/** The flags among (`reporterId`, `titleId`) pairs whose latest close an administrator took, as `reporterId:titleId` keys. */
export async function flagsClosedByAdministrator(
	flags: readonly { reporterId: string; titleId: string }[]
): Promise<Set<string>> {
	const closed = new Set<string>();
	const seen = new Set<string>();
	const wanted = new Set(flags.map((f) => `${f.reporterId}:${f.titleId}`));
	for (const chunk of chunkForD1([...new Set(flags.map((f) => f.reporterId))], 1, 2)) {
		const rows = await db
			.select({
				userId: moderationActions.targetUserId,
				titleId: moderationActions.targetTitleId,
				role: users.role
			})
			.from(moderationActions)
			.leftJoin(users, eq(moderationActions.actorId, users.id))
			.where(
				and(
					inArray(moderationActions.targetUserId, chunk),
					inArray(moderationActions.action, ['resolve_count_flag', 'dismiss_count_flag'])
				)
			)
			.orderBy(desc(moderationActions.createdAt), desc(moderationActions.id));
		for (const row of rows) {
			const key = `${row.userId}:${row.titleId}`;
			if (!wanted.has(key) || seen.has(key)) continue;
			seen.add(key);
			if (row.role === 'administrator') closed.add(key);
		}
	}
	return closed;
}

/** The latest logged `action` row on each of the accounts in `ids`, with its actor's role now. */
export async function latestActionRows(
	action: 'mute' | 'ban',
	ids: readonly string[]
): Promise<Map<string, { id: string; actorRole: string | null }>> {
	const latest = new Map<string, { id: string; actorRole: string | null }>();
	for (const chunk of chunkForD1(ids, 1, 1)) {
		const rows = await db
			.select({
				id: moderationActions.id,
				userId: moderationActions.targetUserId,
				role: users.role
			})
			.from(moderationActions)
			.leftJoin(users, eq(moderationActions.actorId, users.id))
			.where(
				and(inArray(moderationActions.targetUserId, chunk), eq(moderationActions.action, action))
			)
			.orderBy(desc(moderationActions.createdAt), desc(moderationActions.id));
		for (const row of rows) {
			if (row.userId !== null && !latest.has(row.userId)) {
				latest.set(row.userId, { id: row.id, actorRole: row.role });
			}
		}
	}
	return latest;
}

/** The accounts among `ids` whose latest logged mute a moderator set (`muteSetByModerator`). */
export async function accountsMutedByModerator(ids: readonly string[]): Promise<Set<string>> {
	const latest = await latestActionRows('mute', ids);
	return new Set([...latest].filter(([, row]) => row.actorRole === 'moderator').map(([id]) => id));
}
