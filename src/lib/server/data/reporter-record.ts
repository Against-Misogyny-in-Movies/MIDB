import { eq, inArray, sql, type SQL } from 'drizzle-orm';
import { chunkForD1 } from '#db/lib/chunkForD1.ts';
import { db } from '#lib/server/db.ts';
import { commentReports, comments } from '#db/schema/community.ts';

/** How an account's own comment reports fared. */
export type ReporterRecord = {
	/** Every comment report the account made, whatever its status. */
	total: number;
	/** Reports that were upheld (`upheldReport`). */
	upheld: number;
	/** Reports a moderator dismissed (`status = 'dismissed'`). */
	dismissed: number;
};

/**
 * A comment report is upheld when a moderator acted on its comment (the report is `resolved`, which
 * hiding or rejecting the comment sets), or when it is still open on a comment that is
 * hidden or rejected by other means (the classifier, a ban). A report a moderator dismissed is
 * never upheld, and an open report on a comment that is pending, published or deleted is neither
 * upheld nor dismissed yet. Over a select that joins `comment_reports` and `comments`.
 */
export const upheldReport: SQL = sql`(${commentReports.status} = 'resolved' OR (${commentReports.status} = 'open' AND ${comments.status} IN ('hidden', 'rejected')))`;

/** The records of the accounts in `ids`, by id; an account with no reports has no entry. */
export async function reporterRecords(
	ids: readonly (string | null)[]
): Promise<Map<string, ReporterRecord>> {
	const records = new Map<string, ReporterRecord>();
	const known = [...new Set(ids.filter((id) => id !== null))];
	for (const chunk of chunkForD1(known, 1)) {
		for (const row of await db
			.select({
				reporterId: commentReports.reporterId,
				total: sql<number>`count(*)`,
				upheld: sql<number>`coalesce(sum(CASE WHEN ${upheldReport} THEN 1 ELSE 0 END), 0)`,
				dismissed: sql<number>`coalesce(sum(CASE WHEN ${commentReports.status} = 'dismissed' THEN 1 ELSE 0 END), 0)`
			})
			.from(commentReports)
			.innerJoin(comments, eq(commentReports.commentId, comments.id))
			.where(inArray(commentReports.reporterId, chunk))
			.groupBy(commentReports.reporterId)) {
			records.set(row.reporterId, {
				total: row.total,
				upheld: row.upheld,
				dismissed: row.dismissed
			});
		}
	}
	return records;
}
