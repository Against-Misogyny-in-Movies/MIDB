import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import type { SQLiteSelect } from 'drizzle-orm/sqlite-core';
import { chunkForD1 } from '#db/lib/chunkForD1.ts';
import { db } from '#lib/server/db.ts';
import { users } from '#db/schema/auth.ts';
import { commentReports, comments } from '#db/schema/community.ts';
import { titles } from '#db/schema/titles.ts';
import type { PublicUser } from '#lib/media/types/user.ts';
import type { OwnComment, ReportReason } from '#lib/media/types/comments.ts';
import { REJECT_MIN_SEVERITY } from '#lib/media/utils/comments.ts';
import { toOwnComment, type CommentWithTitle } from './comment-queries.ts';
import { activeMute } from './mute.ts';
import { accountsMutedByModerator } from './moderation-target.ts';
import {
	afterPriority,
	priorityCursorOf,
	priorityOrder,
	severityRank
} from './moderation-priority.ts';
import { toQueuePage, type QueuePage } from './queue-cursor.ts';
import { reporterRecords, type ReporterRecord } from './reporter-record.ts';
import { toPublicUser, type UserRow } from './user-queries.ts';

/** Rows per queue tab. */
export const QUEUE_LIMIT = 50;

/** The longest excerpt of a parent comment a panel shows. */
export const PARENT_EXCERPT_MAX = 160;

export type ModerationItem = {
	comment: OwnComment;
	author: PublicUser;
	title: { kind: CommentWithTitle['title']['kind']; tmdbId: number | null; name: string };
	/** The classifier's categories, when it ran. */
	aiCategories: string[];
	/** The classifier's severity, 0 to 3; null when no verdict ran or it failed. */
	severity: number | null;
	/** Whether the severity is at or above `REJECT_MIN_SEVERITY`, so the comment starts collapsed. */
	severe: boolean;
	/** The comment this one replies to, for the thread context; null for a top-level comment. */
	parent: {
		/** The parent's author, as the panel names them, and the account the name links to. */
		author: string;
		authorId: string;
		authorUsername: string | null;
		/** The start of the parent's text; null when the parent is deleted. */
		excerpt: string | null;
	} | null;
	/** Each open report with its reporter's username (staff see it); null when the account has none. */
	reports: {
		reason: ReportReason;
		note: string | null;
		createdAt: string;
		reporter: string | null;
		/** The reporter's account, for the link to its page. */
		reporterId: string;
		/** How the reporter's own reports fared (`reporter-record.ts`). */
		record: ReporterRecord;
	}[];
	/** How many comments the author has written in all, as context for the decision. */
	authorCommentCount: number;
	/** How many of their comments are hidden or rejected now, and how many open reports name them. */
	authorHiddenOrRejected: number;
	authorOpenReportsAgainst: number;
	/** When the author's account was created (ISO). */
	authorJoinedAt: string;
	/** When the author's mute ends, while it is in the future; otherwise null. */
	authorMutedUntil: string | null;
	/** Whether the author is banned, so the item offers Lift ban in place of Mute and Ban. */
	authorBanned: boolean;
	/** Whether a moderator set the author's latest mute, which a moderator may end (`muteSetByModerator`). */
	authorMutedByModerator: boolean;
};

/** What a stored verdict says, read once: the categories, the severity and the failure code. */
export type ReadVerdict = {
	categories: string[];
	/** 0 to 3; null when no verdict ran or it failed. */
	severity: number | null;
	/** The failure code when the classifier gave no verdict, otherwise null. */
	failure: string | null;
};

/** Reads a stored verdict; an unreadable one reads as none. */
export function readAiVerdict(json: string | null): ReadVerdict {
	const none: ReadVerdict = { categories: [], severity: null, failure: null };
	if (!json) return none;
	try {
		const parsed = JSON.parse(json) as {
			categories?: unknown;
			severity?: unknown;
			failure?: unknown;
		} | null;
		return {
			categories: Array.isArray(parsed?.categories)
				? parsed.categories.filter((c): c is string => typeof c === 'string')
				: [],
			severity: typeof parsed?.severity === 'number' ? parsed.severity : null,
			failure: typeof parsed?.failure === 'string' ? parsed.failure : null
		};
	} catch {
		return none;
	}
}

/** The number of open reports on the comment of the enclosing select. */
export const openReportCount = sql`(SELECT count(*) FROM ${commentReports} WHERE ${commentReports.commentId} = ${comments.id} AND ${commentReports.status} = 'open')`;

/** The parent comments of a list, by id: their author and the start of their text. */
async function parentsOf(parentIds: (string | null)[]) {
	const found = new Map<string, NonNullable<ModerationItem['parent']>>();
	for (const chunk of chunkForD1([...new Set(parentIds.filter((id) => id !== null))], 1)) {
		for (const row of await db
			.select({ id: comments.id, body: comments.body, status: comments.status, author: users })
			.from(comments)
			.innerJoin(users, eq(comments.userId, users.id))
			.where(inArray(comments.id, chunk))) {
			found.set(row.id, {
				author: toPublicUser(row.author).displayName,
				authorId: row.author.id,
				authorUsername: row.author.username,
				excerpt: row.status === 'deleted' ? null : row.body.slice(0, PARENT_EXCERPT_MAX)
			});
		}
	}
	return found;
}

/** The rows of a moderation list with their open reports and author context. */
export async function toModerationItems(
	rows: {
		comment: typeof comments.$inferSelect;
		author: UserRow;
		title: typeof titles.$inferSelect;
	}[]
): Promise<ModerationItem[]> {
	const ids = rows.map((r) => r.comment.id);
	const authorIds = [...new Set(rows.map((r) => r.author.id))];
	const reports: {
		commentId: string;
		reason: ReportReason;
		note: string | null;
		createdAt: Date;
		reporter: string | null;
		reporterId: string;
	}[] = [];
	for (const chunk of chunkForD1(ids, 1, 1)) {
		reports.push(
			...(await db
				.select({
					commentId: commentReports.commentId,
					reason: commentReports.reason,
					note: commentReports.note,
					createdAt: commentReports.createdAt,
					reporter: users.username,
					reporterId: commentReports.reporterId
				})
				.from(commentReports)
				.leftJoin(users, eq(commentReports.reporterId, users.id))
				.where(and(inArray(commentReports.commentId, chunk), eq(commentReports.status, 'open')))
				.orderBy(desc(commentReports.createdAt)))
		);
	}
	const counts = new Map<string, number>();
	for (const chunk of chunkForD1(authorIds, 1)) {
		for (const row of await db
			.select({ userId: comments.userId, n: sql<number>`count(*)` })
			.from(comments)
			.where(inArray(comments.userId, chunk))
			.groupBy(comments.userId)) {
			counts.set(row.userId, row.n);
		}
	}
	const withheld = new Map<string, number>();
	const against = new Map<string, number>();
	for (const chunk of chunkForD1(authorIds, 1, 2)) {
		for (const row of await db
			.select({ userId: comments.userId, n: sql<number>`count(*)` })
			.from(comments)
			.where(and(inArray(comments.userId, chunk), inArray(comments.status, ['hidden', 'rejected'])))
			.groupBy(comments.userId)) {
			withheld.set(row.userId, row.n);
		}
		for (const row of await db
			.select({ userId: comments.userId, n: sql<number>`count(*)` })
			.from(commentReports)
			.innerJoin(comments, eq(commentReports.commentId, comments.id))
			.where(and(inArray(comments.userId, chunk), eq(commentReports.status, 'open')))
			.groupBy(comments.userId)) {
			against.set(row.userId, row.n);
		}
	}
	const records = await reporterRecords(reports.map((r) => r.reporterId));
	const parents = await parentsOf(rows.map((r) => r.comment.parentId));
	const mutedAuthors = rows.map((r) => r.author).filter((a) => activeMute(a.mutedUntil) !== null);
	const mutedByModerator = await accountsMutedByModerator(mutedAuthors.map((a) => a.id));
	return rows.map(({ comment, author, title }) => {
		const verdict = readAiVerdict(comment.aiVerdict);
		return {
			comment: toOwnComment(comment),
			author: toPublicUser(author),
			title: { kind: title.kind, tmdbId: title.tmdbId, name: title.title },
			aiCategories: verdict.categories,
			severity: verdict.severity,
			severe: verdict.severity !== null && verdict.severity >= REJECT_MIN_SEVERITY,
			parent: (comment.parentId && parents.get(comment.parentId)) || null,
			reports: reports
				.filter((r) => r.commentId === comment.id)
				.map((r) => ({
					reason: r.reason,
					note: r.note,
					createdAt: r.createdAt.toISOString(),
					reporter: r.reporter,
					reporterId: r.reporterId,
					record: records.get(r.reporterId) ?? { total: 0, upheld: 0, dismissed: 0 }
				})),
			authorCommentCount: counts.get(author.id) ?? 0,
			authorHiddenOrRejected: withheld.get(author.id) ?? 0,
			authorOpenReportsAgainst: against.get(author.id) ?? 0,
			authorJoinedAt: author.createdAt.toISOString(),
			authorMutedUntil: activeMute(author.mutedUntil),
			authorBanned: author.bannedAt !== null,
			authorMutedByModerator: mutedByModerator.has(author.id)
		};
	});
}

/** Adds the author and the title to a select from comments, so every list reads the same rows. */
export const withContext = <Query extends SQLiteSelect>(query: Query) =>
	query
		.innerJoin(users, eq(comments.userId, users.id))
		.innerJoin(titles, eq(comments.titleId, titles.id));

const keyOf = (r: {
	rank: number;
	reportCount: number;
	comment: { createdAt: Date; id: string };
}) => ({
	rank: r.rank,
	reportCount: r.reportCount,
	createdAt: r.comment.createdAt,
	id: r.comment.id
});

const commentRows = () =>
	withContext(
		db
			.select({
				comment: comments,
				author: users,
				title: titles,
				rank: severityRank,
				reportCount: sql<number>`${openReportCount}`
			})
			.from(comments)
			.$dynamic()
	);

/**
 * Comments waiting for a moderator, in priority order (`moderation-priority.ts`): the most
 * severe verdict first, then the most open reports, then the oldest. A cursor this module did not
 * make reads as the first page.
 */
export async function listPendingQueue(
	cursor?: string | null,
	limit = QUEUE_LIMIT
): Promise<QueuePage<ModerationItem>> {
	const rows = await commentRows()
		.where(and(eq(comments.status, 'pending'), afterPriority(cursor, openReportCount)))
		.orderBy(...priorityOrder(openReportCount))
		.limit(limit + 1);
	const page = toQueuePage(rows, limit, (r) => priorityCursorOf(keyOf(r)));
	return { ...page, items: await toModerationItems(page.items) };
}

/**
 * Pending and published comments with open reports, in the same priority order as Pending. A
 * page resumes after the last row's sort key, so a report or a verdict that changes between two
 * page loads can move a row across the boundary; the row still shows once on the page that holds
 * it.
 */
export async function listReportedQueue(
	cursor?: string | null,
	limit = QUEUE_LIMIT
): Promise<QueuePage<ModerationItem>> {
	const rows = await commentRows()
		.where(
			and(
				inArray(comments.status, ['pending', 'published']),
				sql`${openReportCount} > 0`,
				afterPriority(cursor, openReportCount)
			)
		)
		.orderBy(...priorityOrder(openReportCount))
		.limit(limit + 1);
	const page = toQueuePage(rows, limit, (r) => priorityCursorOf(keyOf(r)));
	return { ...page, items: await toModerationItems(page.items) };
}
