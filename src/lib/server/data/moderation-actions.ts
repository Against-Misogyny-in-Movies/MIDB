import { and, eq, sql, type SQL } from 'drizzle-orm';
import { db } from '#lib/server/db.ts';
import { users } from '#db/schema/auth.ts';
import { commentReports, comments, moderationActions } from '#db/schema/community.ts';
import type { CommentStatus } from '#lib/media/types/comments.ts';
import type { moderationAction } from '#lib/media/utils/comments.ts';
import { getCommentWithTitle, type CommentWithTitle } from './comment-queries.ts';
import {
	runBatch,
	runMove,
	statusMove,
	stillIn,
	editedSince,
	unchangedSince,
	type BatchStatement,
	type EditedAt
} from './comment-status.ts';
import {
	lastActionByAdministrator,
	notBoundByAdministrator,
	targetAllowed
} from './moderation-target.ts';
import { replyAuthorsAffected } from './comment-reply-authors.ts';
import type { PurgePlan } from '#lib/server/moderation/purge.ts';
import { banReach, banWeightStatements } from './ban-weight.ts';
import { banStatements, type UserRow } from './user-queries.ts';
import { logRow } from './moderation-log.ts';

type Action = (typeof moderationAction)[number];

export type ModerationResult =
	| {
			ok: true;
			title: CommentWithTitle['title'] | null;
			/** The comment's author, when the action changed what their public profile shows. */
			authorId?: string;
			/** The authors of its published replies, whose profiles name it, when it entered or left `published`. */
			replyAuthorIds?: string[];
			/** What a mute or a ban changed in the caches (`purgeOutcome`); a comment action has none. */
			purge?: PurgePlan;
	  }
	| {
			ok: false;
			/**
			 * `edited`: the text changed after the moderator's view loaded. `admin-acted`: an
			 * administrator took the latest action, which binds a moderator. `already-banned`: a ban or
			 * a mute of an account that is banned.
			 */
			reason:
				| 'not-found'
				| 'invalid-state'
				| 'forbidden-target'
				| 'edited'
				| 'admin-acted'
				| 'already-banned';
	  };

/**
 * The log row for an action on a comment, written only if the comment is still in `from` when
 * the batch runs, so a lost race leaves neither a move nor a log line.
 */
function logCommentAction(
	actorId: string,
	commentId: string,
	action: Action,
	reason: string | null,
	from: CommentStatus,
	extraWhere: SQL = sql`1 = 1`,
	rowId?: string
): BatchStatement {
	return db.insert(moderationActions).select(
		db
			.select(logRow(actorId, action, { commentId: comments.id, reason, id: rowId }))
			.from(comments)
			.where(and(eq(comments.id, commentId), eq(comments.status, from), extraWhere))
	);
}

const hasOpenReports = (commentId: string) =>
	sql`EXISTS (SELECT 1 FROM comment_reports r WHERE r.comment_id = ${commentId} AND r.status = 'open')`;

/**
 * Resolves or dismisses a comment's open reports, only while the comment is still in
 * `expected` (and, when `editedAt` is given, unedited since the moderator's view, and while
 * `extra` holds), so a batch whose status move is lost resolves nothing. It returns the rows it
 * changed.
 */
const resolveOpenReports = (
	commentId: string,
	actorId: string,
	status: 'resolved' | 'dismissed',
	expected: CommentStatus,
	editedAt?: EditedAt,
	extra?: SQL
) =>
	db
		.update(commentReports)
		.set({ status, resolvedBy: actorId })
		.where(
			and(
				eq(commentReports.commentId, commentId),
				eq(commentReports.status, 'open'),
				stillIn(commentId, expected, editedAt),
				extra
			)
		)
		.returning({ id: commentReports.id });

/**
 * Why a batch that moved nothing lost: an administrator acted on the comment after the
 * moderator's read (`admin-acted`, when `bound`), the comment's text changed since the moderator's
 * view (`edited`), or it left the expected status or lost its reports (`invalid-state`).
 */
async function lostRace(
	commentId: string,
	from: readonly CommentStatus[],
	editedAt: EditedAt | undefined,
	bound: boolean
): Promise<'admin-acted' | 'edited' | 'invalid-state'> {
	if (bound && (await lastActionByAdministrator(commentId))) return 'admin-acted';
	const [now] = await db
		.select({ status: comments.status, editedAt: comments.editedAt })
		.from(comments)
		.where(eq(comments.id, commentId));
	const stale =
		editedAt !== undefined &&
		now &&
		from.includes(now.status) &&
		editedSince(now.editedAt, editedAt);
	return stale ? 'edited' : 'invalid-state';
}

/**
 * A moderator is bound by an administrator's latest action on the comment; an administrator is
 * not. The read answers the refusal early, and the batch carries `notBoundByAdministrator`, so an
 * administrator who acts after it still wins.
 */
const boundByAdministrator = (actor: UserRow) => actor.role !== 'administrator';
async function heldByAdministrator(actor: UserRow, commentId: string): Promise<boolean> {
	return boundByAdministrator(actor) && (await lastActionByAdministrator(commentId));
}

/**
 * One moderator action on a comment, as a single batch: the log row, the status move (with its
 * reply counts) and the resolution of the comment's open reports. The actor must be allowed to
 * act on the comment's author (`targetAllowed`), and a moderator may not act on a comment whose
 * latest action an administrator took (`admin-acted`: read before the batch, and guarded inside it
 * by `notBoundByAdministrator`, so an administrator acting in between is not overridden). A spec with `editedAt` makes the
 * comment public only if its stored `editedAt` still equals it, so the moderator publishes the
 * text they saw; a comment edited since answers `edited`. When the comment left the expected
 * status between the read and the batch, nothing is written and the result is `invalid-state`.
 */
async function moveComment(
	actor: UserRow,
	commentId: string,
	action: Action,
	spec: {
		from: readonly CommentStatus[];
		to: CommentStatus;
		reason: string | null;
		reports: 'resolved' | 'dismissed' | null;
		/** The `editedAt` the moderator's view showed, for an action that publishes. */
		editedAt?: EditedAt;
	}
): Promise<ModerationResult> {
	const found = await getCommentWithTitle(commentId);
	if (!found) return { ok: false, reason: 'not-found' };
	const { comment, title } = found;
	const author = await targetAllowed(actor, comment.userId);
	if (typeof author === 'string') return { ok: false, reason: author };
	if (await heldByAdministrator(actor, commentId)) return { ok: false, reason: 'admin-acted' };
	if (!spec.from.includes(comment.status)) return { ok: false, reason: 'invalid-state' };
	if (spec.editedAt !== undefined && editedSince(comment.editedAt, spec.editedAt)) {
		return { ok: false, reason: 'edited' };
	}
	const bound = boundByAdministrator(actor);
	const logId = crypto.randomUUID();
	const adminGuard = bound ? notBoundByAdministrator(commentId, logId) : undefined;
	const version = spec.editedAt === undefined ? undefined : unchangedSince(spec.editedAt);
	const guard = and(version, adminGuard);

	// Read before the move, so a failed read cannot leave a move whose purge is skipped.
	const replyAuthorIds = await replyAuthorsAffected(commentId, comment.status, spec.to);
	const moved = await runMove([
		logCommentAction(actor.id, commentId, action, spec.reason, comment.status, guard, logId),
		...(spec.reports
			? [
					resolveOpenReports(
						commentId,
						actor.id,
						spec.reports,
						comment.status,
						spec.editedAt,
						adminGuard
					)
				]
			: []),
		...statusMove(
			commentId,
			comment.status,
			spec.to,
			{ moderationSource: 'moderator', moderationReason: spec.reason },
			guard
		)
	]);
	if (!moved) {
		return { ok: false, reason: await lostRace(commentId, spec.from, spec.editedAt, bound) };
	}
	return { ok: true, title, authorId: comment.userId, replyAuthorIds };
}

/**
 * Publishes a pending comment; its reports, if any, are dismissed. `editedAt` is the value the
 * moderator's view showed (milliseconds, null when never edited).
 */
export const approveComment = (actor: UserRow, commentId: string, editedAt: EditedAt) =>
	moveComment(actor, commentId, 'approve', {
		from: ['pending'],
		to: 'published',
		reason: null,
		reports: 'dismissed',
		editedAt
	});

/** Takes a pending or published comment out of view, keeping it for its replies and the author. */
export const hideComment = (actor: UserRow, commentId: string, reason: string | null) =>
	moveComment(actor, commentId, 'hide', {
		from: ['pending', 'published'],
		to: 'hidden',
		reason,
		reports: 'resolved'
	});

/** Rejects a pending or published comment; the author sees the reason. */
export const rejectComment = (actor: UserRow, commentId: string, reason: string | null) =>
	moveComment(actor, commentId, 'reject', {
		from: ['pending', 'published'],
		to: 'rejected',
		reason,
		reports: 'resolved'
	});

/** Puts a hidden or rejected comment back in the public list; `editedAt` is as for `approveComment`. */
export const restoreComment = (actor: UserRow, commentId: string, editedAt: EditedAt) =>
	moveComment(actor, commentId, 'restore', {
		from: ['hidden', 'rejected'],
		to: 'published',
		reason: null,
		reports: null,
		editedAt
	});

/**
 * Dismisses a comment's open reports. A comment that the reports sent back to review is
 * published again, only if its stored `editedAt` still equals the moderator's (as for
 * `approveComment`); any other status stays as it is.
 */
export async function dismissReports(
	actor: UserRow,
	commentId: string,
	editedAt: EditedAt
): Promise<ModerationResult> {
	const found = await getCommentWithTitle(commentId);
	if (!found) return { ok: false, reason: 'not-found' };
	const { comment, title } = found;
	const author = await targetAllowed(actor, comment.userId);
	if (typeof author === 'string') return { ok: false, reason: author };
	if (await heldByAdministrator(actor, commentId)) return { ok: false, reason: 'admin-acted' };
	const [{ open }] = await db
		.select({ open: sql<number>`count(*)` })
		.from(commentReports)
		.where(and(eq(commentReports.commentId, commentId), eq(commentReports.status, 'open')));
	if (open === 0) return { ok: false, reason: 'invalid-state' };

	const restores = comment.status === 'pending' && comment.moderationSource === 'reports';
	if (restores && editedSince(comment.editedAt, editedAt)) return { ok: false, reason: 'edited' };
	const bound = boundByAdministrator(actor);
	const logId = crypto.randomUUID();
	const adminGuard = bound ? notBoundByAdministrator(commentId, logId) : undefined;
	const version = restores ? unchangedSince(editedAt) : undefined;
	const replyAuthorIds = restores
		? await replyAuthorsAffected(commentId, 'pending', 'published')
		: [];
	const results = await runBatch([
		logCommentAction(
			actor.id,
			commentId,
			'dismiss',
			null,
			comment.status,
			and(hasOpenReports(commentId), version, adminGuard),
			logId
		),
		resolveOpenReports(
			commentId,
			actor.id,
			'dismissed',
			comment.status,
			restores ? editedAt : undefined,
			adminGuard
		),
		...(restores
			? statusMove(
					commentId,
					'pending',
					'published',
					{ moderationSource: null, moderationReason: null },
					and(version, adminGuard)
				)
			: [])
	]);
	const resolved = results[1];
	if (!Array.isArray(resolved) || resolved.length === 0) {
		return {
			ok: false,
			reason: restores
				? await lostRace(commentId, ['pending'], editedAt, bound)
				: bound && (await lastActionByAdministrator(commentId))
					? 'admin-acted'
					: 'invalid-state'
		};
	}
	if (!restores) return { ok: true, title };
	return { ok: true, title, authorId: comment.userId, replyAuthorIds };
}

function logUserAction(
	actorId: string,
	targetUserId: string,
	action: Action,
	reason: string | null,
	muteHours: number | null = null
) {
	return db.insert(moderationActions).values({ actorId, targetUserId, action, reason, muteHours });
}

/**
 * Stops a user from commenting for `hours` hours from now; the log row keeps the length. A
 * moderator's mute never ends before an active one does. The
 * counts of every title the account reported leave it out, and so does its profile's list of
 * counted reports, so their cached counts and the profile are purged.
 */
export async function muteUser(
	actor: UserRow,
	targetId: string,
	hours: number,
	reason: string | null
): Promise<ModerationResult> {
	const target = await targetAllowed(actor, targetId, 'restrict');
	if (typeof target === 'string') return { ok: false, reason: target };
	const until = Date.now() + hours * 3_600_000;
	// A moderator never shortens an active mute; an administrator may set any length.
	const mutedUntil =
		actor.role === 'administrator'
			? new Date(until)
			: sql<Date>`max(coalesce(${users.mutedUntil}, 0), ${until})`;
	await runBatch([
		db.update(users).set({ mutedUntil }).where(eq(users.id, targetId)),
		logUserAction(actor.id, targetId, 'mute', reason, hours)
	]);
	return { ok: true, title: null, purge: { profiles: [targetId], reportedBy: targetId } };
}

/**
 * Bans a user and ends their sessions (`banStatements`), with the log row in the same batch.
 * The same batch takes the account's weight away: its comment votes are deleted and the score
 * of every comment it voted on is recomputed without them, and its published and pending
 * comments become `hidden` (source `moderator`, reason "Account banned") with their parents'
 * reply counts adjusted. The statements select by the account's id, so no id list is bound.
 * The counts of every title the account reported leave it out, so the result's `purge` names
 * their counts, the profile, which is a 404 from now on, the lists of the titles and the
 * profiles of the authors that the votes and hidden comments touched.
 */
export async function banAccount(
	actor: UserRow,
	targetId: string,
	reason: string | null
): Promise<ModerationResult> {
	const target = await targetAllowed(actor, targetId, 'restrict');
	if (typeof target === 'string') return { ok: false, reason: target };
	const reach = await banReach(targetId);
	await runBatch([
		...banStatements(targetId, reason),
		logUserAction(actor.id, targetId, 'ban', reason),
		...banWeightStatements(targetId)
	]);
	return {
		ok: true,
		title: null,
		purge: {
			commentTitles: reach.titles,
			profiles: [targetId, ...reach.profiles],
			reportedBy: targetId
		}
	};
}
