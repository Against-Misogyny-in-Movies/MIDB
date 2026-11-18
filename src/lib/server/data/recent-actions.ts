import { and, desc, eq, inArray, lt, or, sql } from 'drizzle-orm';
import { chunkForD1 } from '#db/lib/chunkForD1.ts';
import { db } from '#lib/server/db.ts';
import { users } from '#db/schema/auth.ts';
import { comments, moderationActions, titleCountFlags } from '#db/schema/community.ts';
import { titles } from '#db/schema/titles.ts';
import type { PublicUser } from '#lib/media/types/user.ts';
import type { CommentStatus, ModerationRule } from '#lib/media/types/comments.ts';
import type { moderationAction } from '#lib/media/utils/comments.ts';
import type { CommentWithTitle } from './comment-queries.ts';
import { activeMute } from './mute.ts';
import { flagsClosedByAdministrator, latestActionRows } from './moderation-target.ts';
import { QUEUE_LIMIT } from './moderation-queue.ts';
import { QUEUE_SHAPES, decodeQueueCursor, toQueuePage, type QueuePage } from './queue-cursor.ts';
import { reversedActions, type ReversedAction } from './moderation-reverses.ts';
import { toPublicUser } from './user-queries.ts';

type Action = (typeof moderationAction)[number];

const FLAG_ACTIONS = ['resolve_count_flag', 'dismiss_count_flag', 'reopen_flag'] as const;

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
	/**
	 * Whether this row is the latest hide or reject logged on its comment, so the log offers
	 * Restore on that row only; false on every other row.
	 */
	latestForComment: boolean;
	/**
	 * The count flag a flag action closed or re-opened, and its status now, so the log can re-open
	 * it. `closedByAdministrator` says an administrator took its latest close, which binds a moderator.
	 */
	flag: {
		id: string;
		status: (typeof titleCountFlags.$inferSelect)['status'];
		closedByAdministrator: boolean;
	} | null;
	/** The earlier action this one undid (End mute, Lift ban, Restore, Re-open); null on any other row, or when none is logged (`moderation-reverses.ts`). */
	reverses: ReversedAction | null;
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
	/** Only these actions. */
	actions?: readonly Action[];
	/** Only the actions this staff member took. */
	actorId?: string;
};

/** The id of the latest hide or reject row of each of the comments `ids`, by comment id. */
async function latestHiddenOrRejected(ids: readonly string[]): Promise<Map<string, string>> {
	const latest = new Map<string, string>();
	for (const chunk of chunkForD1([...new Set(ids)], 1, 2)) {
		const rows = await db
			.select({ id: moderationActions.id, commentId: moderationActions.targetCommentId })
			.from(moderationActions)
			.where(
				and(
					inArray(moderationActions.targetCommentId, chunk),
					inArray(moderationActions.action, ['hide', 'reject'])
				)
			)
			.orderBy(desc(moderationActions.createdAt), desc(moderationActions.id));
		for (const row of rows) {
			if (row.commentId !== null && !latest.has(row.commentId)) latest.set(row.commentId, row.id);
		}
	}
	return latest;
}

/** The condition of a log filter over `moderation_actions`; undefined for none. */
function logFilterWhere(filter: LogFilter) {
	const account = filter.accountId
		? or(
				eq(moderationActions.targetUserId, filter.accountId),
				inArray(
					moderationActions.targetCommentId,
					db.select({ id: comments.id }).from(comments).where(eq(comments.userId, filter.accountId))
				)
			)
		: undefined;
	return and(
		filter.actions ? inArray(moderationActions.action, [...filter.actions]) : undefined,
		filter.actorId ? eq(moderationActions.actorId, filter.actorId) : undefined,
		account
	);
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
	const reversed = await reversedActions(rows.map((r) => r.action));
	const latestRestorable = await latestHiddenOrRejected(
		rows
			.filter((r) => r.action.action === 'hide' || r.action.action === 'reject')
			.map((r) => r.action.targetCommentId)
			.filter((id) => id !== null)
	);
	const adminClosed = await flagsClosedByAdministrator(
		rows
			.filter((r) => r.flagId && r.action.targetUserId && r.action.targetTitleId)
			.map((r) => ({
				reporterId: r.action.targetUserId as string,
				titleId: r.action.targetTitleId as string
			}))
	);
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
			latestForComment: latestRestorable.get(action.targetCommentId ?? '') === action.id,
			flag:
				flagId && flagStatus
					? {
							id: flagId,
							status: flagStatus,
							closedByAdministrator: adminClosed.has(
								`${action.targetUserId}:${action.targetTitleId}`
							)
						}
					: null,
			reverses: reversed.get(action.id) ?? null,
			title: title && title.name !== null ? title : null
		})
	);
	return { items, nextCursor };
}
