import { alias } from 'drizzle-orm/sqlite-core';
import { and, eq, inArray, sql, type SQL } from 'drizzle-orm';
import { db } from '#lib/server/db.ts';
import { users } from '#db/schema/auth.ts';
import { commentReports, commentVotes, comments, moderationActions } from '#db/schema/community.ts';
import { titles } from '#db/schema/titles.ts';
import type { CommentStatus } from '#lib/media/types/comments.ts';
import type { moderationAction } from '#lib/media/utils/comments.ts';
import { getCommentWithTitle, type CommentWithTitle } from './comment-queries.ts';
import {
	runBatch,
	runMove,
	statusMove,
	stillIn,
	unchangedSince,
	type BatchStatement,
	type EditedAt
} from './comment-status.ts';
import { lastActionByAdministrator, targetAllowed } from './moderation-target.ts';
import { replyAuthorsAffected } from './comment-reply-authors.ts';
import { purgeProfile, purgeProfiles, purgeTitlesComments } from '#lib/server/http/purge-title.ts';
import { purgeReportedTitles } from './community-report-moderation.ts';
import { banStatements, type UserRow } from './user-queries.ts';

type Action = (typeof moderationAction)[number];

export type ModerationResult =
	| {
			ok: true;
			title: CommentWithTitle['title'] | null;
			/** The comment's author, when the action changed what their public profile shows. */
			authorId?: string;
			/** The authors of its published replies, whose profiles name it, when it entered or left `published`. */
			replyAuthorIds?: string[];
	  }
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
	from: CommentStatus,
	extraWhere: SQL = sql`1 = 1`
): BatchStatement {
	return db.insert(moderationActions).select(
		db
			.select({
				id: sql<string>`${crypto.randomUUID()}`.as('id'),
				actorId: sql<string>`${actorId}`.as('actorId'),
				targetCommentId: comments.id,
				targetUserId: sql<string | null>`NULL`.as('targetUserId'),
				targetTitleId: sql<string | null>`NULL`.as('targetTitleId'),
				action: sql<Action>`${action}`.as('action'),
				reason: sql<string | null>`${reason}`.as('reason'),
				muteHours: sql<number | null>`NULL`.as('muteHours'),
				createdAt: sql<number>`${Date.now()}`.as('createdAt')
			})
			.from(comments)
			.where(and(eq(comments.id, commentId), eq(comments.status, from), extraWhere))
	);
}

const hasOpenReports = (commentId: string) =>
	sql`EXISTS (SELECT 1 FROM comment_reports r WHERE r.comment_id = ${commentId} AND r.status = 'open')`;

/**
 * Resolves or dismisses a comment's open reports, only while the comment is still in
 * `expected` (and, when `editedAt` is given, unedited since the moderator's view), so a batch
 * whose status move is lost resolves nothing. It returns the rows it changed.
 */
const resolveOpenReports = (
	commentId: string,
	actorId: string,
	status: 'resolved' | 'dismissed',
	expected: CommentStatus,
	editedAt?: EditedAt
) =>
	db
		.update(commentReports)
		.set({ status, resolvedBy: actorId })
		.where(
			and(
				eq(commentReports.commentId, commentId),
				eq(commentReports.status, 'open'),
				stillIn(commentId, expected, editedAt)
			)
		)
		.returning({ id: commentReports.id });

/** A moderator is bound by an administrator's latest action on the comment; an administrator is not. */
async function heldByAdministrator(actor: UserRow, commentId: string): Promise<boolean> {
	return actor.role !== 'administrator' && (await lastActionByAdministrator(commentId));
}

/**
 * One moderator action on a comment, as a single batch: the log row, the status move (with its
 * reply counts) and the resolution of the comment's open reports. The actor must be allowed to
 * act on the comment's author (`targetAllowed`), and a moderator may not undo an administrator's
 * latest action when `spec.adminBinds` is set. A spec with `editedAt` makes the comment public
 * only if its stored `editedAt` still equals it, so the moderator publishes the text they saw.
 * When the comment left the expected status or was edited between the read and the batch,
 * nothing is written and the result is `invalid-state`.
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
		/** Whether a moderator may not act on a comment an administrator last acted on. */
		adminBinds?: boolean;
	}
): Promise<ModerationResult> {
	const found = await getCommentWithTitle(commentId);
	if (!found) return { ok: false, reason: 'not-found' };
	const { comment, title } = found;
	const author = await targetAllowed(actor, comment.userId);
	if (typeof author === 'string') return { ok: false, reason: author };
	if (spec.adminBinds && (await heldByAdministrator(actor, commentId))) {
		return { ok: false, reason: 'forbidden-target' };
	}
	if (!spec.from.includes(comment.status)) return { ok: false, reason: 'invalid-state' };
	const version = spec.editedAt === undefined ? undefined : unchangedSince(spec.editedAt);

	// Read before the move, so a failed read cannot leave a move whose purge is skipped.
	const replyAuthorIds = await replyAuthorsAffected(commentId, comment.status, spec.to);
	const moved = await runMove([
		logCommentAction(actor.id, commentId, action, spec.reason, comment.status, version),
		...(spec.reports
			? [resolveOpenReports(commentId, actor.id, spec.reports, comment.status, spec.editedAt)]
			: []),
		...statusMove(
			commentId,
			comment.status,
			spec.to,
			{ moderationSource: 'moderator', moderationReason: spec.reason },
			version
		)
	]);
	if (!moved) return { ok: false, reason: 'invalid-state' };
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
		editedAt,
		adminBinds: true
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
		editedAt,
		adminBinds: true
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
	if (await heldByAdministrator(actor, commentId)) return { ok: false, reason: 'forbidden-target' };
	const [{ open }] = await db
		.select({ open: sql<number>`count(*)` })
		.from(commentReports)
		.where(and(eq(commentReports.commentId, commentId), eq(commentReports.status, 'open')));
	if (open === 0) return { ok: false, reason: 'invalid-state' };

	const restores = comment.status === 'pending' && comment.moderationSource === 'reports';
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
			version ? and(hasOpenReports(commentId), version) : hasOpenReports(commentId)
		),
		resolveOpenReports(
			commentId,
			actor.id,
			'dismissed',
			comment.status,
			restores ? editedAt : undefined
		),
		...(restores
			? statusMove(
					commentId,
					'pending',
					'published',
					{ moderationSource: null, moderationReason: null },
					version
				)
			: [])
	]);
	const resolved = results[1];
	if (!Array.isArray(resolved) || resolved.length === 0) {
		return { ok: false, reason: 'invalid-state' };
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
	purgeProfile(targetId);
	await purgeReportedTitles(targetId);
	return { ok: true, title: null };
}

/** The reason the log row and the hidden comments of a ban carry. */
const BAN_COMMENT_REASON = 'Account banned';

/**
 * What a ban changes that the edge caches show: the titles whose lists lose a hidden comment
 * or a vote, and the profiles of the authors whose scores change and of the authors of the
 * published replies to a hidden comment.
 */
async function banReach(targetId: string) {
	const reply = alias(comments, 'reply');
	const [hidden, voted, replied] = await Promise.all([
		db
			.selectDistinct({ kind: titles.kind, tmdbId: titles.tmdbId })
			.from(comments)
			.innerJoin(titles, eq(comments.titleId, titles.id))
			.where(
				and(eq(comments.userId, targetId), inArray(comments.status, ['published', 'pending']))
			),
		db
			.selectDistinct({ kind: titles.kind, tmdbId: titles.tmdbId, authorId: comments.userId })
			.from(commentVotes)
			.innerJoin(comments, eq(commentVotes.commentId, comments.id))
			.innerJoin(titles, eq(comments.titleId, titles.id))
			.where(eq(commentVotes.userId, targetId)),
		db
			.selectDistinct({ userId: reply.userId })
			.from(comments)
			.innerJoin(reply, eq(reply.parentId, comments.id))
			.where(
				and(
					eq(comments.userId, targetId),
					eq(comments.status, 'published'),
					eq(reply.status, 'published')
				)
			)
	]);
	return {
		titles: [...hidden, ...voted],
		profiles: [...voted.map((v) => v.authorId), ...replied.map((r) => r.userId)]
	};
}

/**
 * Bans a user and ends their sessions (`banStatements`), with the log row in the same batch.
 * The same batch takes the account's weight away: its comment votes are deleted and the score
 * of every comment it voted on is recomputed without them, and its published and pending
 * comments become `hidden` (source `moderator`, reason "Account banned") with their parents'
 * reply counts adjusted. The statements select by the account's id, so no id list is bound.
 * The counts of every title the account reported leave it out, so their cached counts are
 * purged, and so is the profile, which is a 404 from now on, with the lists of the titles and
 * the profiles of the authors that the votes and hidden comments touched.
 */
export async function banAccount(
	actor: UserRow,
	targetId: string,
	reason: string | null
): Promise<ModerationResult> {
	const target = await targetAllowed(actor, targetId, 'restrict');
	if (typeof target === 'string') return { ok: false, reason: target };
	const reach = await banReach(targetId);
	const live = and(
		eq(comments.userId, targetId),
		inArray(comments.status, ['published', 'pending'])
	);
	const publishedOfTarget = sql`SELECT parent_id FROM comments WHERE user_id = ${targetId} AND status = 'published' UNION SELECT root_id FROM comments WHERE user_id = ${targetId} AND status = 'published'`;
	await runBatch([
		...banStatements(targetId, reason),
		logUserAction(actor.id, targetId, 'ban', reason),
		db
			.update(comments)
			.set({
				replyCount: sql`max(${comments.replyCount} - (SELECT count(*) FROM comments c WHERE c.user_id = ${targetId} AND c.status = 'published' AND (c.parent_id = ${comments.id} OR c.root_id = ${comments.id})), 0)`,
				updatedAt: sql`${comments.updatedAt}`
			})
			.where(sql`${comments.id} IN (${publishedOfTarget})`),
		db
			.update(comments)
			.set({
				score: sql`(SELECT coalesce(sum(v.value), 0) FROM comment_votes v WHERE v.comment_id = ${comments.id} AND v.user_id <> ${targetId})`,
				updatedAt: sql`${comments.updatedAt}`
			})
			.where(
				sql`${comments.id} IN (SELECT comment_id FROM comment_votes WHERE user_id = ${targetId})`
			),
		db.delete(commentVotes).where(eq(commentVotes.userId, targetId)),
		db
			.update(comments)
			.set({
				status: 'hidden',
				moderationSource: 'moderator',
				moderationReason: BAN_COMMENT_REASON
			})
			.where(live)
	]);
	purgeProfile(targetId);
	purgeProfiles(reach.profiles);
	purgeTitlesComments(reach.titles);
	await purgeReportedTitles(targetId);
	return { ok: true, title: null };
}
