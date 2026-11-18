import { getTableName, sql } from 'drizzle-orm';
import type { AnySQLiteColumn, SQLiteTable } from 'drizzle-orm/sqlite-core';
import { db } from '#lib/server/db.ts';
import {
	commentReports,
	comments,
	communityContentReports,
	titleCountFlags
} from '#db/schema/community.ts';

/** What each moderation tab's badge counts, as totals in the database (the lists are paged). */
export type ModerationCounts = {
	/** Comments in `pending`. */
	pending: number;
	/** Pending and published comments with at least one open report. */
	reported: number;
	/** Community reports in `held`. */
	held: number;
	/** Titles with at least one open "counts look wrong" flag. */
	flagged: number;
};

/**
 * The column with its table name. A select with no table of its own (`FROM (SELECT 1)`) renders a
 * column bare, so a correlated reference to the outer `comments` row needs the name.
 */
const qualified = (table: SQLiteTable, column: AnySQLiteColumn) =>
	sql`${sql.identifier(getTableName(table))}.${sql.identifier(column.name)}`;

/** One query for every badge: four scalar counts, so a tab switch costs one round trip for them. */
export async function getModerationCounts(): Promise<ModerationCounts> {
	const [row] = await db
		.select({
			pending: sql<number>`(SELECT count(*) FROM ${comments} WHERE ${comments.status} = 'pending')`,
			reported: sql<number>`(SELECT count(*) FROM ${comments} WHERE ${comments.status} IN ('pending', 'published') AND EXISTS (SELECT 1 FROM ${commentReports} WHERE ${qualified(commentReports, commentReports.commentId)} = ${qualified(comments, comments.id)} AND ${qualified(commentReports, commentReports.status)} = 'open'))`,
			held: sql<number>`(SELECT count(*) FROM ${communityContentReports} WHERE ${communityContentReports.status} = 'held')`,
			flagged: sql<number>`(SELECT count(DISTINCT ${titleCountFlags.titleId}) FROM ${titleCountFlags} WHERE ${titleCountFlags.status} = 'open')`
		})
		.from(sql`(SELECT 1) AS one`);
	return row;
}
