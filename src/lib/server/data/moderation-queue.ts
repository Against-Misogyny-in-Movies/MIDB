import { and, desc, eq, inArray, lt, or, sql } from 'drizzle-orm';
import type { SQLiteSelect } from 'drizzle-orm/sqlite-core';
import { chunkForD1 } from '#db/lib/chunkForD1.ts';
import { db } from '#lib/server/db.ts';
import { users } from '#db/schema/auth.ts';
import {
	commentReports,
	comments,
	moderationActions,
	titleCountFlags
} from '#db/schema/community.ts';
import { titles } from '#db/schema/titles.ts';
import type { PublicUser } from '#lib/media/types/user.ts';
import type {
	CommentStatus,
	ModerationRule,
	OwnComment,
	ReportReason
} from '#lib/media/types/comments.ts';
import type { moderationAction } from '#lib/media/utils/comments.ts';
import { REJECT_MIN_SEVERITY } from '#lib/server/moderation/policy.ts';
import { toOwnComment, type CommentWithTitle } from './comment-queries.ts';
import { activeMute } from './mute.ts';
import { accountsMutedByModerator, latestActionRows } from './moderation-target.ts';
import {
	afterPriority,
	priorityCursorOf,
	priorityOrder,
	severityRank
} from './moderation-priority.ts';
import { QUEUE_SHAPES, decodeQueueCursor, toQueuePage, type QueuePage } from './queue-cursor.ts';
import { reporterRecords, type ReporterRecord } from './reporter-record.ts';
import { toPublicUser, type UserRow } from './user-queries.ts';

type Action = (typeof moderationAction)[number];

const FLAG_ACTIONS = ['resolve_count_flag', 'dismiss_count_flag', 'reopen_flag'] as const;

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
		/** The parent's author, as the panel names them. */
		author: string;
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

export type RecentAction = {
	id: string;
	action: Action;
	reason: string | null;
	/** The rule the moderator named for a hide, a reject, a mute or a ban. */
	rule: ModerationRule | null;
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
	/**
	 * Whether this row's mute or ban is still in force: it is the account's latest such row and
	 * the account is still muted or banned. `byModerator` says a moderator wrote the mute, which
	 * a moderator may end. Null on every other row.
	 */
	inForce: { byModerator: boolean } | null;
	/** The count flag a flag action closed or re-opened, and its status now, so the log can re-open it. */
	flag: { id: string; status: (typeof titleCountFlags.$inferSelect)['status'] } | null;
	/** The title the comment is on, or the title a report or count-flag action concerns. */
	title: {
		id: string;
		kind: CommentWithTitle['title']['kind'];
		tmdbId: number | null;
		name: string;
	} | null;
};

/** What narrows the log. */
export type LogFilter = {
	/**
	 * Actions that concern one account: those that name it (`target_user_id`) and those on its
	 * comments (a comment action names the comment only).
	 */
	accountId?: string;
};

/** The condition of a log filter over `moderation_actions`; undefined for none. */
function logFilterWhere(filter: LogFilter) {
	return filter.accountId
		? or(
				eq(moderationActions.targetUserId, filter.accountId),
				inArray(
					moderationActions.targetCommentId,
					db.select({ id: comments.id }).from(comments).where(eq(comments.userId, filter.accountId))
				)
			)
		: undefined;
}

/**
 * A page of the moderation log, newest first (then id), narrowed by `filter`. A cursor this
 * module did not make reads as the first page.
 */
export async function listRecentActions(
	cursor?: string | null,
	limit = QUEUE_LIMIT,
	filter: LogFilter = {}
): Promise<QueuePage<RecentAction>> {
	const after = decodeQueueCursor(cursor, QUEUE_SHAPES.log);
	const found = await db
		.select({
			action: moderationActions,
			targetBody: comments.body,
			targetStatus: comments.status,
			targetEditedAt: comments.editedAt,
			flagId: titleCountFlags.id,
			flagStatus: titleCountFlags.status,
			title: { id: titles.id, kind: titles.kind, tmdbId: titles.tmdbId, name: titles.title }
		})
		.from(moderationActions)
		.leftJoin(comments, eq(moderationActions.targetCommentId, comments.id))
		.leftJoin(
			titleCountFlags,
			and(
				inArray(moderationActions.action, FLAG_ACTIONS),
				eq(titleCountFlags.titleId, moderationActions.targetTitleId),
				eq(titleCountFlags.reporterId, moderationActions.targetUserId)
			)
		)
		.leftJoin(
			titles,
			eq(titles.id, sql`coalesce(${comments.titleId}, ${moderationActions.targetTitleId})`)
		)
		.where(
			and(
				logFilterWhere(filter),
				after
					? or(
							lt(moderationActions.createdAt, new Date(after[0])),
							and(
								eq(moderationActions.createdAt, new Date(after[0])),
								lt(moderationActions.id, after[1])
							)
						)
					: undefined
			)
		)
		.orderBy(desc(moderationActions.createdAt), desc(moderationActions.id))
		.limit(limit + 1);
	const { items: rows, nextCursor } = toQueuePage(found, limit, (r) => [
		r.action.createdAt.getTime(),
		r.action.id
	]);
	const userIds = [
		...new Set(
			rows
				.flatMap(({ action }) => [action.actorId, action.targetUserId])
				.filter((id) => id !== null)
		)
	];
	const people = new Map<string, PublicUser>();
	const standing = new Map<string, { muted: boolean; banned: boolean }>();
	for (const chunk of chunkForD1(userIds, 1)) {
		for (const row of await db.select().from(users).where(inArray(users.id, chunk))) {
			people.set(row.id, toPublicUser(row));
			standing.set(row.id, {
				muted: activeMute(row.mutedUntil) !== null,
				banned: row.bannedAt !== null
			});
		}
	}
	const targetsOf = (action: 'mute' | 'ban') => [
		...new Set(
			rows
				.filter((r) => r.action.action === action && r.action.targetUserId !== null)
				.map((r) => r.action.targetUserId as string)
		)
	];
	const latestMute = await latestActionRows('mute', targetsOf('mute'));
	const latestBan = await latestActionRows('ban', targetsOf('ban'));
	const inForce = (action: typeof moderationActions.$inferSelect): RecentAction['inForce'] => {
		const target = action.targetUserId && standing.get(action.targetUserId);
		if (!target) return null;
		if (action.action === 'mute') {
			const latest = latestMute.get(action.targetUserId as string);
			return target.muted && latest?.id === action.id
				? { byModerator: latest.actorRole === 'moderator' }
				: null;
		}
		if (action.action === 'ban') {
			return target.banned && latestBan.get(action.targetUserId as string)?.id === action.id
				? { byModerator: false }
				: null;
		}
		return null;
	};
	const items: RecentAction[] = rows.map(
		({ action, targetBody, targetStatus, targetEditedAt, flagId, flagStatus, title }) => ({
			id: action.id,
			action: action.action,
			reason: action.reason,
			rule: action.rule,
			createdAt: action.createdAt.toISOString(),
			actor: (action.actorId && people.get(action.actorId)) || null,
			targetUser: (action.targetUserId && people.get(action.targetUserId)) || null,
			muteHours: action.muteHours,
			commentBody: targetBody,
			commentId: action.targetCommentId,
			commentStatus: targetStatus,
			commentEditedAt: targetEditedAt?.toISOString() ?? null,
			inForce: inForce(action),
			flag: flagId && flagStatus ? { id: flagId, status: flagStatus } : null,
			title: title && title.name !== null ? title : null
		})
	);
	return { items, nextCursor };
}
