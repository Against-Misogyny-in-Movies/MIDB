import { and, eq, inArray } from 'drizzle-orm';
import { chunkForD1 } from '#db/lib/chunkForD1.ts';
import { db } from '#lib/server/db.ts';
import { users } from '#db/schema/auth.ts';
import { moderationActions } from '#db/schema/community.ts';
import type { moderationAction } from '#lib/media/utils/comments.ts';

type Action = (typeof moderationAction)[number];
type Row = typeof moderationActions.$inferSelect;

/** The earlier action a reversal undid. */
export type ReversedAction = {
	action: Action;
	/** Its actor's username; null when the account has none or is gone. */
	actor: string | null;
	createdAt: string;
};

/** What each reversing action undoes: the earlier actions on the same target. */
const REVERSES: Partial<Record<Action, readonly Action[]>> = {
	unmute: ['mute'],
	unban: ['ban'],
	restore: ['hide', 'reject'],
	reopen_flag: ['resolve_count_flag', 'dismiss_count_flag']
};

type Candidate = Row & { actorName: string | null };

const before = (a: Row, b: Row) =>
	a.createdAt.getTime() < b.createdAt.getTime() ||
	(a.createdAt.getTime() === b.createdAt.getTime() && a.id < b.id);

/** Every `actions` row whose `column` is one of `ids`, with its actor's username. */
async function candidates(
	column: 'targetUserId' | 'targetCommentId',
	ids: readonly string[],
	actions: readonly Action[]
): Promise<Candidate[]> {
	const found: Candidate[] = [];
	for (const chunk of chunkForD1(ids, 1, actions.length)) {
		const rows = await db
			.select({ action: moderationActions, actorName: users.username })
			.from(moderationActions)
			.leftJoin(users, eq(moderationActions.actorId, users.id))
			.where(
				and(
					inArray(moderationActions[column], chunk),
					inArray(moderationActions.action, [...actions])
				)
			);
		found.push(...rows.map((r) => ({ ...r.action, actorName: r.actorName })));
	}
	return found;
}

/**
 * For each reversing row among `rows` (End mute, Lift ban, Restore, Re-open), the latest earlier
 * action of the kind it undid on the same account, comment or flag (a flag is the account and the
 * title). Nothing in the log names the action a row reverses, so this is the nearest earlier one
 * on the same target; a reversal with none (the earlier row was never logged, or the mute simply
 * ended), or with another reversal of its kind between the two, has no entry. The result is by row id.
 */
export async function reversedActions(rows: readonly Row[]): Promise<Map<string, ReversedAction>> {
	const reversing = rows.filter((r) => REVERSES[r.action]);
	const result = new Map<string, ReversedAction>();
	if (reversing.length === 0) return result;
	const userRows = reversing.filter((r) => r.action !== 'restore' && r.targetUserId !== null);
	const commentRows = reversing.filter((r) => r.action === 'restore' && r.targetCommentId !== null);
	const [byUser, byComment] = await Promise.all([
		candidates(
			'targetUserId',
			[...new Set(userRows.map((r) => r.targetUserId as string))],
			['mute', 'ban', 'resolve_count_flag', 'dismiss_count_flag', 'unmute', 'unban', 'reopen_flag']
		),
		candidates(
			'targetCommentId',
			[...new Set(commentRows.map((r) => r.targetCommentId as string))],
			['hide', 'reject', 'restore']
		)
	]);
	for (const row of reversing) {
		const kinds = REVERSES[row.action] ?? [];
		const pool = row.action === 'restore' ? byComment : byUser;
		const key = row.action === 'restore' ? 'targetCommentId' : 'targetUserId';
		const latest = pool
			.filter(
				(c) =>
					c[key] === row[key] &&
					kinds.includes(c.action) &&
					(row.action !== 'reopen_flag' || c.targetTitleId === row.targetTitleId) &&
					before(c, row)
			)
			.sort((a, b) => (before(a, b) ? 1 : -1))[0];
		// A reversal of the same kind between the two means the row undoes something else.
		const between =
			latest &&
			pool.some(
				(c) =>
					c[key] === row[key] &&
					c.action === row.action &&
					(row.action !== 'reopen_flag' || c.targetTitleId === row.targetTitleId) &&
					before(latest, c) &&
					before(c, row)
			);
		if (latest && !between) {
			result.set(row.id, {
				action: latest.action,
				actor: latest.actorName,
				createdAt: latest.createdAt.toISOString()
			});
		}
	}
	return result;
}
