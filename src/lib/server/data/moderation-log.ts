import { sql, type SQL } from 'drizzle-orm';
import type { AnySQLiteColumn } from 'drizzle-orm/sqlite-core';
import type { moderationAction } from '#lib/media/utils/comments.ts';

type Action = (typeof moderationAction)[number];

/** What a log row points at: a column of the query it selects from, or NULL when it names none. */
type LogTarget = AnySQLiteColumn | SQL.Aliased<string | null>;

const none = (name: string) => sql<string | null>`NULL`.as(name);

/**
 * The columns of one `moderation_actions` row, for `db.insert(moderationActions).select(...)`:
 * the caller selects them `from` the row its action depends on, with a `where` that holds only
 * while the action still applies, so a lost race leaves no log line. The caller names what the
 * row points at (`commentId`, `userId`, `titleId`: a column of that query, or none); the
 * reason and the mute length are constants.
 */
export function logRow(
	actorId: string,
	action: Action,
	target: {
		commentId?: LogTarget;
		userId?: LogTarget;
		titleId?: LogTarget;
		reason?: string | null;
		/** The row's id, when a later statement of the batch must tell this row from the others. */
		id?: string;
	}
) {
	return {
		id: sql<string>`${target.id ?? crypto.randomUUID()}`.as('id'),
		actorId: sql<string>`${actorId}`.as('actorId'),
		targetCommentId: target.commentId ?? none('targetCommentId'),
		targetUserId: target.userId ?? none('targetUserId'),
		targetTitleId: target.titleId ?? none('targetTitleId'),
		action: sql<Action>`${action}`.as('action'),
		reason: sql<string | null>`${target.reason ?? null}`.as('reason'),
		muteHours: sql<number | null>`NULL`.as('muteHours'),
		createdAt: sql<number>`${Date.now()}`.as('createdAt')
	};
}
