import { sql, type SQL } from 'drizzle-orm';
import type { BatchItem } from 'drizzle-orm/batch';
import { db } from '#lib/server/db.ts';
import { comments } from '#db/schema/community.ts';
import type { CommentStatus } from '#lib/media/types/comments.ts';

export type BatchStatement = BatchItem<'sqlite'>;

/** A non-empty statement list is what `db.batch` takes. */
export function runBatch(statements: BatchStatement[]): Promise<unknown> {
	if (statements.length === 0) return Promise.resolve();
	return db.batch(statements as [BatchStatement, ...BatchStatement[]]);
}

/** Fields a status change may set alongside the status itself. */
export type StatusPatch = Partial<
	Pick<
		typeof comments.$inferInsert,
		'body' | 'editedAt' | 'moderationSource' | 'moderationReason' | 'aiVerdict'
	>
>;

/**
 * The statements that move one comment from `from` to `to`, for a `db.batch` (atomic). Both
 * are guarded on the comment still being in `from` (and on `extraWhere`, an extra SQL
 * condition such as a report count), so a concurrent change makes the whole move a no-op instead of
 * leaving `reply_count` off.
 *
 * `reply_count` counts published replies, so a move into or out of `published` adjusts the
 * comment's parent and its root by one (they are the same row on a first-level reply).
 */
export function statusMove(
	id: string,
	from: CommentStatus,
	to: CommentStatus,
	patch: StatusPatch = {},
	extraWhere: SQL = sql`1 = 1`
): BatchStatement[] {
	const delta = Number(to === 'published') - Number(from === 'published');
	const guard = sql`EXISTS (SELECT 1 FROM comments c WHERE c.id = ${id} AND c.status = ${from} AND (${extraWhere}))`;
	const statements: BatchStatement[] = [];
	if (delta !== 0) {
		statements.push(
			db
				.update(comments)
				.set({
					replyCount: sql`max(${comments.replyCount} + ${delta}, 0)`,
					updatedAt: sql`${comments.updatedAt}`
				})
				.where(
					sql`${comments.id} IN (SELECT parent_id FROM comments WHERE id = ${id} UNION SELECT root_id FROM comments WHERE id = ${id}) AND ${guard}`
				)
		);
	}
	statements.push(
		db
			.update(comments)
			.set({ status: to, ...patch })
			.where(sql`${comments.id} = ${id} AND ${comments.status} = ${from} AND (${extraWhere})`)
	);
	return statements;
}

/** The statements that add one to a new published reply's parent and root (same row on a first-level reply). */
export function countNewReply(parentId: string, rootId: string): BatchStatement[] {
	return [
		db
			.update(comments)
			.set({ replyCount: sql`${comments.replyCount} + 1`, updatedAt: sql`${comments.updatedAt}` })
			.where(sql`${comments.id} IN (${parentId}, ${rootId})`)
	];
}
