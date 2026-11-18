import { sql, type SQL } from 'drizzle-orm';
import type { AnySQLiteColumn, AnySQLiteTable } from 'drizzle-orm/sqlite-core';
import { db } from '#lib/server/db.ts';
import { moderationActions } from '#db/schema/community.ts';
import type { moderationAction, moderationRule } from '#lib/media/utils/comments.ts';
import { runBatch, type BatchStatement } from './comment-status.ts';

type Action = (typeof moderationAction)[number];
type Rule = (typeof moderationRule)[number];

/** What a log row points at: a column of the query it selects from, or NULL when it names none. */
type LogTarget = AnySQLiteColumn | SQL.Aliased<string | null>;

const none = (name: string) => sql<string | null>`NULL`.as(name);

/**
 * The columns of one `moderation_actions` row, for `db.insert(moderationActions).select(...)`:
 * the caller selects them `from` the row its action depends on, with a `where` that holds only
 * while the action still applies, so a lost race leaves no log line. The caller names what the
 * row points at (`commentId`, `userId`, `titleId`: a column of that query, or none); the
 * reason, the rule and the mute length are constants.
 */
export function logRow(
	actorId: string,
	action: Action,
	target: {
		commentId?: LogTarget;
		userId?: LogTarget;
		titleId?: LogTarget;
		reason?: string | null;
		/** The rule a hide, a reject, a mute or a ban names. */
		rule?: Rule | null;
		/** The length of a mute, in hours. */
		muteHours?: number;
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
		rule: sql<Rule | null>`${target.rule ?? null}`.as('rule'),
		muteHours: sql<number | null>`${target.muteHours ?? null}`.as('muteHours'),
		createdAt: sql<number>`${Date.now()}`.as('createdAt')
	};
}

/**
 * The log row of an action on a row of `from`, written only while `where` holds
 * (`logRow`'s selection), so a lost race leaves no log line.
 */
export const logWhere = (
	actorId: string,
	action: Action,
	target: Parameters<typeof logRow>[2],
	from: AnySQLiteTable,
	where: SQL | undefined
) =>
	db.insert(moderationActions).select(
		db
			.select(logRow(actorId, action, target))
			.from(from)
			.where(where)
	);

/**
 * Runs a log row, the statements that must come between it and the update, and the update, as
 * one batch, and says whether the update (a statement that `returning`s rows, last) changed a
 * row. The log row and the update carry the same guard, so a lost race is false and wrote
 * neither; the caller re-reads to say why.
 */
export async function runLogged(
	log: BatchStatement,
	update: BatchStatement,
	between: BatchStatement[] = []
): Promise<boolean> {
	const results = await runBatch([log, ...between, update]);
	const changed = results[results.length - 1];
	return Array.isArray(changed) && changed.length > 0;
}
