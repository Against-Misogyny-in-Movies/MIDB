import { and, eq, ne, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/sqlite-core';
import { db } from '#lib/server/db.ts';
import {
	accounts,
	passkeys,
	retiredUsernames,
	sessions,
	users,
	verifications
} from '#db/schema/auth.ts';
import {
	commentAiLabels,
	commentReports,
	commentVotes,
	communityBechdelRatings,
	communityContentReports,
	communityDddVotes,
	communityUmReports,
	comments,
	titleCountFlags
} from '#db/schema/community.ts';
import { titles } from '#db/schema/titles.ts';
import { placeholderEmail } from '#lib/server/auth/placeholder-email.ts';
import { isNotNullViolation } from './db-errors.ts';
import type { BatchStatement } from './comment-status.ts';

/** What a deleted account's comment that keeps replies says in place of its text (`comments.body` needs one character). */
export const DELETED_COMMENT_BODY = '[deleted]';

/** The `name` of a scrubbed account: the column is required, and nothing shows it. */
export const DELETED_ACCOUNT_NAME = 'Deleted account';

type PurgeTitle = { kind: string; tmdbId: number | null };

export type ScrubResult =
	| {
			ok: true;
			/** Titles whose published comment list changed. */
			commentTitles: PurgeTitle[];
			/** Titles whose community report counts changed. */
			reportTitles: PurgeTitle[];
			/** Authors whose public profile named one of the account's published comments. */
			replyAuthorIds: string[];
	  }
	| { ok: false; reason: 'last-administrator' };

/** The ids of the account's comments' threads: a root's own id, or a reply's `root_id`. */
const threadsOf = (userId: string) =>
	sql`SELECT coalesce(t.root_id, t.id) FROM comments t WHERE t.user_id = ${userId}`;

/**
 * Whether another administrator can still act: not deleted and not banned. The scrub's guard and
 * its pre-check share it.
 */
const otherAdministrator = (userId: string) =>
	sql`EXISTS (SELECT 1 FROM "user" o WHERE o.role = 'administrator' AND o.deleted_at IS NULL AND o.banned_at IS NULL AND o.id != ${userId})`;

/**
 * Reads what the purges need, before the batch removes it: the titles of the account's
 * comments and reports, and the authors of published replies to its published comments.
 */
async function readPurgeTargets(userId: string) {
	const parent = alias(comments, 'parent');
	const [commentTitles, reportTitles, replyAuthors] = await Promise.all([
		db
			.selectDistinct({ kind: titles.kind, tmdbId: titles.tmdbId })
			.from(comments)
			.innerJoin(titles, eq(comments.titleId, titles.id))
			.where(eq(comments.userId, userId)),
		db
			.selectDistinct({ kind: titles.kind, tmdbId: titles.tmdbId })
			.from(communityContentReports)
			.innerJoin(titles, eq(communityContentReports.titleId, titles.id))
			.where(eq(communityContentReports.userId, userId)),
		db
			.selectDistinct({ userId: comments.userId })
			.from(comments)
			.innerJoin(parent, eq(comments.parentId, parent.id))
			.where(
				and(
					eq(parent.userId, userId),
					eq(parent.status, 'published'),
					eq(comments.status, 'published'),
					ne(comments.userId, userId)
				)
			)
	]);
	return { commentTitles, reportTitles, replyAuthorIds: replyAuthors.map((r) => r.userId) };
}

/**
 * The statements of the scrub, in the order they must run: each one reads what an earlier one
 * leaves in place, so the order is part of the logic.
 */
function scrubStatements(userId: string, username: string | null, now: Date): BatchStatement[] {
	return [
		// The abort for the last administrator: setting the NOT NULL email to NULL fails the
		// whole batch, which D1 rolls back, when no other administrator remains. D1 runs one
		// batch at a time, so two administrators deleting themselves together cannot both pass.
		db
			.update(users)
			.set({ email: sql`NULL` })
			.where(
				sql`${users.id} = ${userId} AND ${users.role} = 'administrator' AND NOT ${otherAdministrator(userId)}`
			),
		// The old username is held back like one given up by a rename (`updateProfile`).
		...(username === null
			? []
			: [
					db
						.insert(retiredUsernames)
						.values({ username: username.toLowerCase(), userId, retiredAt: now })
						.onConflictDoUpdate({
							target: retiredUsernames.username,
							set: { userId, retiredAt: now }
						})
				]),
		db
			.delete(verifications)
			.where(
				sql`${verifications.identifier} = ${userId} OR ${verifications.identifier} = (SELECT email FROM "user" WHERE id = ${userId})`
			),
		// Votes: the scores of the comments the account voted on are recomputed from the
		// remaining votes, as a vote removal does (`comment-votes.ts`), then its votes go.
		db
			.update(comments)
			.set({
				score: sql`coalesce((SELECT sum(v.value) FROM comment_votes v WHERE v.comment_id = ${comments.id} AND v.user_id != ${userId}), 0)`,
				updatedAt: sql`${comments.updatedAt}`
			})
			.where(
				sql`${comments.id} IN (SELECT comment_id FROM comment_votes WHERE user_id = ${userId})`
			),
		db.delete(commentVotes).where(eq(commentVotes.userId, userId)),
		db.delete(commentReports).where(eq(commentReports.reporterId, userId)),
		db.delete(titleCountFlags).where(eq(titleCountFlags.reporterId, userId)),
		db.delete(communityContentReports).where(eq(communityContentReports.userId, userId)),
		db.delete(communityBechdelRatings).where(eq(communityBechdelRatings.userId, userId)),
		db.delete(communityUmReports).where(eq(communityUmReports.userId, userId)),
		db.delete(communityDddVotes).where(eq(communityDddVotes.userId, userId)),
		// Every comment of the account loses its text and its moderation notes. Marking them all
		// deleted first takes them out of the published counts below.
		db
			.update(comments)
			.set({
				status: 'deleted',
				body: DELETED_COMMENT_BODY,
				moderationReason: null,
				aiVerdict: null
			})
			.where(eq(comments.userId, userId)),
		db
			.delete(commentAiLabels)
			.where(
				sql`${commentAiLabels.commentId} IN (SELECT id FROM comments WHERE user_id = ${userId})`
			),
		// `reply_count` of every comment in a thread the account wrote in, recounted as the
		// writes keep it (`comment-status.ts`): a root counts the published comments of its
		// thread, any other comment its published direct replies.
		db
			.update(comments)
			.set({
				replyCount: sql`CASE WHEN ${comments.parentId} IS NULL
					THEN (SELECT count(*) FROM comments r WHERE r.root_id = ${comments.id} AND r.status = 'published')
					ELSE (SELECT count(*) FROM comments r WHERE r.parent_id = ${comments.id} AND r.status = 'published')
					END`,
				updatedAt: sql`${comments.updatedAt}`
			})
			.where(
				sql`${comments.id} IN (${threadsOf(userId)}) OR ${comments.rootId} IN (${threadsOf(userId)})`
			),
		// A comment stays when someone else's comment, in any status, sits below it, because a
		// row delete cascades to its replies. The ancestors of every other account's comment in
		// these threads are the ones to keep; the rest go, with their votes, reports and labels.
		db.delete(comments).where(
			sql`${comments.userId} = ${userId} AND ${comments.id} NOT IN (
				WITH RECURSIVE up(id, parent_id) AS (
					SELECT d.id, d.parent_id FROM comments d
						WHERE d.user_id != ${userId} AND d.root_id IN (${threadsOf(userId)})
					UNION
					SELECT c.id, c.parent_id FROM comments c JOIN up ON c.id = up.parent_id
				)
				SELECT id FROM up
			)`
		),
		db.delete(sessions).where(eq(sessions.userId, userId)),
		db.delete(accounts).where(eq(accounts.userId, userId)),
		db.delete(passkeys).where(eq(passkeys.userId, userId)),
		// The row stays, with nothing personal. A ban and a mute stay as they are, so a banned
		// account is still refused.
		db
			.update(users)
			.set({
				name: DELETED_ACCOUNT_NAME,
				email: placeholderEmail(userId),
				emailVerified: false,
				image: null,
				username: null,
				avatarKey: null,
				usernameChangedAt: null,
				role: 'user',
				deletedAt: now
			})
			.where(eq(users.id, userId))
	];
}

/**
 * Deletes an account's personal data and leaves the `user` row scrubbed (`user.deleted_at`).
 * The row is kept because `comments.user_id` cascades, and a reply cascades from its parent, so
 * deleting it would delete other readers' replies. Everything is one `db.batch`, which D1 runs
 * as a transaction: the scrub is whole or not applied. Nothing here is chunked: every statement
 * binds the account id and a few constants, far under `D1_MAX_PARAMS`.
 *
 * What the purges need is read first and returned for the caller (`DELETE /api/me`) to purge
 * once the batch has committed. The username to retire is read there too, so a rename that
 * lands between that read and the batch retires the earlier name. A write that lands between that read and the batch leaves one
 * cached entry for its short edge TTL (`docs/architecture.md`, Caching policy).
 *
 * Refuses the last administrator (`last-administrator`), checked inside the batch.
 */
export async function scrubAccount(userId: string): Promise<ScrubResult> {
	const [self] = await db
		.select({ username: users.username })
		.from(users)
		.where(eq(users.id, userId));
	const targets = await readPurgeTargets(userId);
	try {
		await db.batch(
			scrubStatements(userId, self?.username ?? null, new Date()) as [
				BatchStatement,
				...BatchStatement[]
			]
		);
	} catch (err) {
		if (isNotNullViolation(err, 'user.email')) return { ok: false, reason: 'last-administrator' };
		throw err;
	}
	return { ok: true, ...targets };
}
