import { and, desc, eq, inArray, sql } from 'drizzle-orm';
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

/** The categories in a stored verdict; an unreadable one reads as none. */
function verdictCategories(json: string | null): string[] {
	if (!json) return [];
	try {
		const parsed: unknown = JSON.parse(json);
		const categories = (parsed as { categories?: unknown } | null)?.categories;
		return Array.isArray(categories) ? categories.filter((c) => typeof c === 'string') : [];
	} catch {
		return [];
	}
}

async function toItems(
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
		aiCategories: verdictCategories(comment.aiVerdict),
		reports: reports
			.filter((r) => r.commentId === comment.id)
			.map((r) => ({ reason: r.reason, note: r.note, createdAt: r.createdAt.toISOString() })),
		authorCommentCount: counts.get(author.id) ?? 0,
		authorMutedUntil: activeMute(author.mutedUntil)
	}));
}

const withContext = () =>
	db
		.select({ comment: comments, author: users, title: titles })
		.from(comments)
		.innerJoin(users, eq(comments.userId, users.id))
		.innerJoin(titles, eq(comments.titleId, titles.id));

/** Comments waiting for a moderator, oldest first. */
export async function listPendingQueue(): Promise<ModerationItem[]> {
	return toItems(
		await withContext()
			.where(eq(comments.status, 'pending'))
			.orderBy(comments.createdAt)
			.limit(QUEUE_LIMIT)
	);
}

/** Pending and published comments with open reports, most reported first. */
export async function listReportedQueue(): Promise<ModerationItem[]> {
	const open = sql`(SELECT count(*) FROM ${commentReports} WHERE ${commentReports.commentId} = ${comments.id} AND ${commentReports.status} = 'open')`;
	return toItems(
		await withContext()
			.where(and(inArray(comments.status, ['pending', 'published']), sql`${open} > 0`))
			.orderBy(sql`${open} DESC`, comments.createdAt)
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
