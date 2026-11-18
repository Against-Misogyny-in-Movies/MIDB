import { and, desc, eq } from 'drizzle-orm';
import { db } from '#lib/server/db.ts';
import { users } from '#db/schema/auth.ts';
import { commentReports, comments } from '#db/schema/community.ts';
import { titles } from '#db/schema/titles.ts';
import type { CommentStatus, ModerationRule, ReportReason } from '#lib/media/types/comments.ts';
import { reporterRecords, type ReporterRecord } from './reporter-record.ts';
import { getUserRatings, type UserRating } from './user-queries.ts';

/** How many rows each list on an account's page shows; the page says when there are more. */
export const ACCOUNT_LIST_LIMIT = 50;

type TitleRef = { kind: (typeof titles.$inferSelect)['kind']; tmdbId: number | null; name: string };

const titleColumns = { kind: titles.kind, tmdbId: titles.tmdbId, name: titles.title };

export type AccountComment = {
	id: string;
	body: string;
	status: CommentStatus;
	moderationReason: string | null;
	moderationRule: ModerationRule | null;
	isReply: boolean;
	createdAt: string;
	editedAt: string | null;
	title: TitleRef;
};

/** The account's newest comments in every status, read-only. */
export async function listAccountComments(userId: string): Promise<AccountComment[]> {
	const rows = await db
		.select({ comment: comments, title: titleColumns })
		.from(comments)
		.innerJoin(titles, eq(comments.titleId, titles.id))
		.where(eq(comments.userId, userId))
		.orderBy(desc(comments.createdAt), desc(comments.id))
		.limit(ACCOUNT_LIST_LIMIT);
	return rows.map(({ comment, title }) => ({
		id: comment.id,
		body: comment.body,
		status: comment.status,
		moderationReason: comment.moderationReason,
		moderationRule: comment.moderationRule,
		isReply: comment.parentId !== null,
		createdAt: comment.createdAt.toISOString(),
		editedAt: comment.editedAt?.toISOString() ?? null,
		title
	}));
}

export type AccountReport = Omit<UserRating, 'updatedAt' | 'countsFrom'> & {
	updatedAt: string;
	countsFrom: string;
};

/** The account's community reports in every status, newest first, with what their standing reads from. */
export async function listAccountReports(userId: string): Promise<AccountReport[]> {
	const rows = await getUserRatings(userId);
	return rows.slice(0, ACCOUNT_LIST_LIMIT).map((row) => ({
		...row,
		updatedAt: row.updatedAt.toISOString(),
		countsFrom: row.countsFrom.toISOString()
	}));
}

export type ReportAgainst = {
	reason: ReportReason;
	note: string | null;
	createdAt: string;
	reporter: string | null;
	reporterId: string;
	record: ReporterRecord;
	comment: { id: string; body: string; status: CommentStatus; title: TitleRef };
};

/** The open reports against the account's comments, newest first, with each reporter's record. */
export async function listReportsAgainst(userId: string): Promise<ReportAgainst[]> {
	const rows = await db
		.select({
			reason: commentReports.reason,
			note: commentReports.note,
			createdAt: commentReports.createdAt,
			reporter: users.username,
			reporterId: commentReports.reporterId,
			commentId: comments.id,
			body: comments.body,
			status: comments.status,
			title: titleColumns
		})
		.from(commentReports)
		.innerJoin(comments, eq(commentReports.commentId, comments.id))
		.innerJoin(titles, eq(comments.titleId, titles.id))
		.leftJoin(users, eq(commentReports.reporterId, users.id))
		.where(and(eq(comments.userId, userId), eq(commentReports.status, 'open')))
		.orderBy(desc(commentReports.createdAt), desc(commentReports.id))
		.limit(ACCOUNT_LIST_LIMIT);
	const records = await reporterRecords(rows.map((r) => r.reporterId));
	return rows.map((r) => ({
		reason: r.reason,
		note: r.note,
		createdAt: r.createdAt.toISOString(),
		reporter: r.reporter,
		reporterId: r.reporterId,
		record: records.get(r.reporterId) ?? { total: 0, upheld: 0, dismissed: 0 },
		comment: { id: r.commentId, body: r.body, status: r.status, title: r.title }
	}));
}
