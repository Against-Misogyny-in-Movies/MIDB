import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import { chunkForD1 } from '#db/lib/chunkForD1.ts';
import { db } from '#lib/server/db.ts';
import { users } from '#db/schema/auth.ts';
import { commentReports, comments, moderationActions } from '#db/schema/community.ts';
import { titles } from '#db/schema/titles.ts';
import type { PublicUser } from '#lib/media/types/user.ts';
import type { CommentStatus, OwnComment, ReportReason } from '#lib/media/types/comments.ts';
import type { moderationAction } from '#lib/media/utils/comments.ts';
import { toOwnComment, getCommentWithTitle, type CommentWithTitle } from './comment-queries.ts';
import { runBatch, statusMove, type BatchStatement } from './comment-status.ts';
import { banStatements, toPublicUser, type UserRow } from './user-queries.ts';

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
		authorCommentCount: counts.get(author.id) ?? 0
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
	/** The comment's text, so the log reads without opening it. */
	commentBody: string | null;
	/** The comment acted on and where it is now, so a hide or a reject can be undone from the log. */
	commentId: string | null;
	commentStatus: CommentStatus | null;
};

/** The latest moderation actions, newest first. */
export async function listRecentActions(limit = QUEUE_LIMIT): Promise<RecentAction[]> {
	const rows = await db
		.select({
			action: moderationActions,
			targetBody: comments.body,
			targetStatus: comments.status
		})
		.from(moderationActions)
		.leftJoin(comments, eq(moderationActions.targetCommentId, comments.id))
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
	return rows.map(({ action, targetBody, targetStatus }) => ({
		id: action.id,
		action: action.action,
		reason: action.reason,
		createdAt: action.createdAt.toISOString(),
		actor: (action.actorId && people.get(action.actorId)) || null,
		targetUser: (action.targetUserId && people.get(action.targetUserId)) || null,
		commentBody: targetBody,
		commentId: action.targetCommentId,
		commentStatus: targetStatus
	}));
}

export type ModerationResult =
	| { ok: true; title: CommentWithTitle['title'] | null }
	| { ok: false; reason: 'not-found' | 'invalid-state' | 'forbidden-target' };

/**
 * The log row for an action on a comment, written only if the comment is still in `from` when
 * the batch runs, so a lost race leaves neither a move nor a log line.
 */
function logCommentAction(
	actorId: string,
	commentId: string,
	action: Action,
	reason: string | null,
	from: CommentStatus
): BatchStatement {
	return db.insert(moderationActions).select(
		db
			.select({
				id: sql<string>`${crypto.randomUUID()}`.as('id'),
				actorId: sql<string>`${actorId}`.as('actorId'),
				targetCommentId: comments.id,
				targetUserId: sql<string | null>`NULL`.as('targetUserId'),
				action: sql<Action>`${action}`.as('action'),
				reason: sql<string | null>`${reason}`.as('reason'),
				createdAt: sql<number>`${Date.now()}`.as('createdAt')
			})
			.from(comments)
			.where(and(eq(comments.id, commentId), eq(comments.status, from)))
	);
}

const resolveOpenReports = (commentId: string, actorId: string, status: 'resolved' | 'dismissed') =>
	db
		.update(commentReports)
		.set({ status, resolvedBy: actorId })
		.where(and(eq(commentReports.commentId, commentId), eq(commentReports.status, 'open')));

/**
 * One moderator action on a comment, as a single batch: the log row, the status move (with its
 * reply counts) and the resolution of the comment's open reports.
 */
async function moveComment(
	actorId: string,
	commentId: string,
	action: Action,
	spec: {
		from: readonly CommentStatus[];
		to: CommentStatus;
		reason: string | null;
		reports: 'resolved' | 'dismissed' | null;
	}
): Promise<ModerationResult> {
	const found = await getCommentWithTitle(commentId);
	if (!found) return { ok: false, reason: 'not-found' };
	const { comment, title } = found;
	if (!spec.from.includes(comment.status)) return { ok: false, reason: 'invalid-state' };

	await runBatch([
		logCommentAction(actorId, commentId, action, spec.reason, comment.status),
		...(spec.reports ? [resolveOpenReports(commentId, actorId, spec.reports)] : []),
		...statusMove(commentId, comment.status, spec.to, {
			moderationSource: 'moderator',
			moderationReason: spec.reason
		})
	]);
	return { ok: true, title };
}

/** Publishes a pending comment; its reports, if any, are dismissed. */
export const approveComment = (actorId: string, commentId: string) =>
	moveComment(actorId, commentId, 'approve', {
		from: ['pending'],
		to: 'published',
		reason: null,
		reports: 'dismissed'
	});

/** Takes a pending or published comment out of view, keeping it for its replies and the author. */
export const hideComment = (actorId: string, commentId: string, reason: string | null) =>
	moveComment(actorId, commentId, 'hide', {
		from: ['pending', 'published'],
		to: 'hidden',
		reason,
		reports: 'resolved'
	});

/** Rejects a pending or published comment; the author sees the reason. */
export const rejectComment = (actorId: string, commentId: string, reason: string | null) =>
	moveComment(actorId, commentId, 'reject', {
		from: ['pending', 'published'],
		to: 'rejected',
		reason,
		reports: 'resolved'
	});

/** Puts a hidden or rejected comment back in the public list. */
export const restoreComment = (actorId: string, commentId: string) =>
	moveComment(actorId, commentId, 'restore', {
		from: ['hidden', 'rejected'],
		to: 'published',
		reason: null,
		reports: null
	});

/**
 * Dismisses a comment's open reports. A comment that the reports sent back to review is
 * published again; any other status stays as it is.
 */
export async function dismissReports(
	actorId: string,
	commentId: string
): Promise<ModerationResult> {
	const found = await getCommentWithTitle(commentId);
	if (!found) return { ok: false, reason: 'not-found' };
	const { comment, title } = found;
	const [{ open }] = await db
		.select({ open: sql<number>`count(*)` })
		.from(commentReports)
		.where(and(eq(commentReports.commentId, commentId), eq(commentReports.status, 'open')));
	if (open === 0) return { ok: false, reason: 'invalid-state' };

	const restores = comment.status === 'pending' && comment.moderationSource === 'reports';
	await runBatch([
		logCommentAction(actorId, commentId, 'dismiss', null, comment.status),
		resolveOpenReports(commentId, actorId, 'dismissed'),
		...(restores
			? statusMove(commentId, 'pending', 'published', {
					moderationSource: null,
					moderationReason: null
				})
			: [])
	]);
	return { ok: true, title };
}

/**
 * A moderator may act on an ordinary account; only an administrator may act on a moderator; no
 * one acts on an administrator or on themselves.
 */
async function targetAllowed(
	actor: UserRow,
	targetId: string
): Promise<UserRow | 'not-found' | 'forbidden-target'> {
	if (actor.id === targetId) return 'forbidden-target';
	const [target] = await db.select().from(users).where(eq(users.id, targetId));
	if (!target) return 'not-found';
	if (target.role === 'administrator') return 'forbidden-target';
	if (target.role === 'moderator' && actor.role !== 'administrator') return 'forbidden-target';
	return target;
}

function logUserAction(
	actorId: string,
	targetUserId: string,
	action: Action,
	reason: string | null
) {
	return db.insert(moderationActions).values({ actorId, targetUserId, action, reason });
}

/** Stops a user from commenting until `until`. */
export async function muteUser(
	actor: UserRow,
	targetId: string,
	until: Date,
	reason: string | null
): Promise<ModerationResult> {
	const target = await targetAllowed(actor, targetId);
	if (typeof target === 'string') return { ok: false, reason: target };
	await runBatch([
		db.update(users).set({ mutedUntil: until }).where(eq(users.id, targetId)),
		logUserAction(actor.id, targetId, 'mute', reason)
	]);
	return { ok: true, title: null };
}

/** Bans a user and ends their sessions (`banStatements`), with the log row in the same batch. */
export async function banAccount(
	actor: UserRow,
	targetId: string,
	reason: string | null
): Promise<ModerationResult> {
	const target = await targetAllowed(actor, targetId);
	if (typeof target === 'string') return { ok: false, reason: target };
	await runBatch([
		...banStatements(targetId, reason),
		logUserAction(actor.id, targetId, 'ban', reason)
	]);
	return { ok: true, title: null };
}
