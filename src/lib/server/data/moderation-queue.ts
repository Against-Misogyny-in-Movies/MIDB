import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import type { SQLiteSelect } from 'drizzle-orm/sqlite-core';
import { chunkForD1 } from '#db/lib/chunkForD1.ts';
import { db } from '#lib/server/db.ts';
import { users } from '#db/schema/auth.ts';
import { commentReports, comments, moderationActions } from '#db/schema/community.ts';
import { titles } from '#db/schema/titles.ts';
import type { PublicUser } from '#lib/media/types/user.ts';
import type { CommentStatus, OwnComment, ReportReason } from '#lib/media/types/comments.ts';
import type { moderationAction } from '#lib/media/utils/comments.ts';
import { toOwnComment, type CommentWithTitle } from './comment-queries.ts';
import { activeMute } from './mute.ts';
import { toPublicUser, type UserRow } from './user-queries.ts';

type Action = (typeof moderationAction)[number];

/** Rows per queue tab. */
export const QUEUE_LIMIT = 50;

export type ModerationItem = {
	comment: OwnComment;
	author: PublicUser;
	title: { kind: CommentWithTitle['title']['kind']; tmdbId: number | null; name: string };
	/** The classifier's categories, when it ran. */
	aiCategories: string[];
	reports: { reason: ReportReason; note: string | null; createdAt: string }[];
	/** How many comments the author has written in all, as context for the decision. */
	authorCommentCount: number;
	/** When the author's mute ends, while it is in the future; otherwise null. */
	authorMutedUntil: string | null;
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
	}[] = [];
	for (const chunk of chunkForD1(ids, 1, 1)) {
		reports.push(
			...(await db
				.select({
					commentId: commentReports.commentId,
					reason: commentReports.reason,
					note: commentReports.note,
					createdAt: commentReports.createdAt
				})
				.from(commentReports)
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
	return rows.map(({ comment, author, title }) => ({
		comment: toOwnComment(comment),
		author: toPublicUser(author),
		title: { kind: title.kind, tmdbId: title.tmdbId, name: title.title },
		aiCategories: readAiVerdict(comment.aiVerdict).categories,
		reports: reports
			.filter((r) => r.commentId === comment.id)
			.map((r) => ({ reason: r.reason, note: r.note, createdAt: r.createdAt.toISOString() })),
		authorCommentCount: counts.get(author.id) ?? 0,
		authorMutedUntil: activeMute(author.mutedUntil)
	}));
}

/** Adds the author and the title to a select from comments, so every list reads the same rows. */
export const withContext = <Query extends SQLiteSelect>(query: Query) =>
	query
		.innerJoin(users, eq(comments.userId, users.id))
		.innerJoin(titles, eq(comments.titleId, titles.id));

const commentRows = () =>
	withContext(
		db.select({ comment: comments, author: users, title: titles }).from(comments).$dynamic()
	);

/** Comments waiting for a moderator, oldest first. */
export async function listPendingQueue(): Promise<ModerationItem[]> {
	return toModerationItems(
		await commentRows()
			.where(eq(comments.status, 'pending'))
			.orderBy(comments.createdAt)
			.limit(QUEUE_LIMIT)
	);
}

/** Pending and published comments with open reports, most reported first. */
export async function listReportedQueue(): Promise<ModerationItem[]> {
	return toModerationItems(
		await commentRows()
			.where(and(inArray(comments.status, ['pending', 'published']), sql`${openReportCount} > 0`))
			.orderBy(sql`${openReportCount} DESC`, comments.createdAt)
			.limit(QUEUE_LIMIT)
	);
}

export type RecentAction = {
	id: string;
	action: Action;
	reason: string | null;
	createdAt: string;
	actor: PublicUser | null;
	targetUser: PublicUser | null;
	/** The length of a mute, in hours; null on every other action. */
	muteHours: number | null;
	/** The comment's text, so the log reads without opening it. */
	commentBody: string | null;
	/** The comment acted on and where it is now, so a hide or a reject can be undone from the log. */
	commentId: string | null;
	commentStatus: CommentStatus | null;
	/** When the author last edited the comment, so the log can say it changed after the action. */
	commentEditedAt: string | null;
	/** The title the comment is on, or the title a report or count-flag action concerns. */
	title: {
		id: string;
		kind: CommentWithTitle['title']['kind'];
		tmdbId: number | null;
		name: string;
	} | null;
};

/** The latest moderation actions, newest first. */
export async function listRecentActions(limit = QUEUE_LIMIT): Promise<RecentAction[]> {
	const rows = await db
		.select({
			action: moderationActions,
			targetBody: comments.body,
			targetStatus: comments.status,
			targetEditedAt: comments.editedAt,
			title: { id: titles.id, kind: titles.kind, tmdbId: titles.tmdbId, name: titles.title }
		})
		.from(moderationActions)
		.leftJoin(comments, eq(moderationActions.targetCommentId, comments.id))
		.leftJoin(
			titles,
			eq(titles.id, sql`coalesce(${comments.titleId}, ${moderationActions.targetTitleId})`)
		)
		.orderBy(desc(moderationActions.createdAt), desc(moderationActions.id))
		.limit(limit);
	const userIds = [
		...new Set(
			rows
				.flatMap(({ action }) => [action.actorId, action.targetUserId])
				.filter((id) => id !== null)
		)
	];
	const people = new Map<string, PublicUser>();
	for (const chunk of chunkForD1(userIds, 1)) {
		for (const row of await db.select().from(users).where(inArray(users.id, chunk))) {
			people.set(row.id, toPublicUser(row));
		}
	}
	return rows.map(({ action, targetBody, targetStatus, targetEditedAt, title }) => ({
		id: action.id,
		action: action.action,
		reason: action.reason,
		createdAt: action.createdAt.toISOString(),
		actor: (action.actorId && people.get(action.actorId)) || null,
		targetUser: (action.targetUserId && people.get(action.targetUserId)) || null,
		muteHours: action.muteHours,
		commentBody: targetBody,
		commentId: action.targetCommentId,
		commentStatus: targetStatus,
		commentEditedAt: targetEditedAt?.toISOString() ?? null,
		title: title && title.name !== null ? title : null
	}));
}
