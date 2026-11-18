import { and, asc, eq, gt, or, sql, type SQL } from 'drizzle-orm';
import { comments } from '#db/schema/community.ts';
import { QUEUE_SHAPES, decodeQueueCursor } from './queue-cursor.ts';

/**
 * The order of the Pending and Reported lists: the classifier's severity first (highest first),
 * then the number of open reports (most first), then the oldest comment, then the id so the order
 * is total and a cursor resumes exactly. The All comments table keeps its own sorts.
 *
 * The severity is ranked in whole steps so a cursor holds integers: a verdict with severity `s`
 * ranks `2 * s`, and a comment with no usable verdict (none ran, the check failed, or the stored
 * JSON has no numeric severity) ranks 1, so it sits below severity 1 (rank 2) and above a verdict that
 * found nothing (rank 0). An unchecked comment has not been read by anything, so it is not placed
 * with the ones the classifier cleared.
 */
export const severityRank = sql<number>`CASE WHEN ${comments.aiVerdict} IS NOT NULL AND json_type(${comments.aiVerdict}, '$.severity') IN ('integer', 'real') THEN CAST(json_extract(${comments.aiVerdict}, '$.severity') AS INTEGER) * 2 ELSE 1 END`;

/** The sort key of a row, as the list selects it, for the cursor. */
export type PriorityKey = { rank: number; reportCount: number; createdAt: Date; id: string };

/** ORDER BY for the lists, over the select's `rank` and `reportCount` expressions. */
export const priorityOrder = (reportCount: SQL): SQL[] => [
	sql`${severityRank} DESC`,
	sql`${reportCount} DESC`,
	asc(comments.createdAt),
	asc(comments.id)
];

/** The cursor parts of the last row of a page: rank, open reports, `created_at` (ms), id. */
export const priorityCursorOf = (key: PriorityKey) =>
	[key.rank, key.reportCount, key.createdAt.getTime(), key.id] as const;

/**
 * The condition that selects the rows after a cursor `priorityCursorOf` made, or undefined for
 * the first page (also for a cursor that list did not make).
 */
export function afterPriority(
	cursor: string | null | undefined,
	reportCount: SQL
): SQL | undefined {
	const after = decodeQueueCursor(cursor, QUEUE_SHAPES.pending);
	if (!after) return undefined;
	const [rank, reports, at, id] = after;
	const created = new Date(at);
	return or(
		sql`${severityRank} < ${rank}`,
		and(
			sql`${severityRank} = ${rank}`,
			or(
				sql`${reportCount} < ${reports}`,
				and(
					sql`${reportCount} = ${reports}`,
					or(
						gt(comments.createdAt, created),
						and(eq(comments.createdAt, created), gt(comments.id, id))
					)
				)
			)
		)
	);
}
