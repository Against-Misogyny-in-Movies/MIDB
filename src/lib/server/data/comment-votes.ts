import { and, eq, sql } from 'drizzle-orm';
import { db } from '#lib/server/db.ts';
import { commentVotes, comments } from '#db/schema/community.ts';
import { accountOldEnough } from './counting-account.ts';

export type VoteResult =
	| { ok: true; score: number; vote: 1 | -1 | null }
	| { ok: false; reason: 'not-found' | 'own-comment' | 'account-too-new' };

/** The comment's `score` is set to the sum of its votes, in the same batch as the vote itself. */
const scoreFromVotes = (commentId: string) =>
	db
		.update(comments)
		.set({
			score: sql`(SELECT coalesce(sum(${commentVotes.value}), 0) FROM ${commentVotes} WHERE ${commentVotes.commentId} = ${commentId})`,
			updatedAt: sql`${comments.updatedAt}`
		})
		.where(eq(comments.id, commentId));

/** Only a published comment of someone else's can be voted on. Returns the refusal, or null. */
async function votable(
	commentId: string,
	userId: string
): Promise<Extract<VoteResult, { ok: false }> | null> {
	const [row] = await db
		.select({ userId: comments.userId, status: comments.status })
		.from(comments)
		.where(eq(comments.id, commentId));
	if (!row || row.status !== 'published') return { ok: false, reason: 'not-found' };
	if (row.userId === userId) return { ok: false, reason: 'own-comment' };
	return null;
}

/**
 * Sets the reader's vote on a comment (+1 or -1; a repeated or changed vote rewrites the row).
 * An account younger than `REPORT_ACCOUNT_MIN_AGE_DAYS` is refused (`account-too-new`) unless
 * it is staff; removing a vote has no such limit.
 * The vote row and the score are one `db.batch`, and the score is recomputed from the votes
 * rather than nudged by a delta, so a repeat, a flip or a concurrent vote cannot leave it wrong.
 * Votes do not bump `updated_at` and purge nothing: the cached list trails the score, and the
 * voter's own reload shows it through the viewer state (`getViewerCommentState`).
 */
export async function setVote(
	commentId: string,
	user: { id: string; role: string; createdAt: Date },
	value: 1 | -1
): Promise<VoteResult> {
	if (!accountOldEnough(user)) return { ok: false, reason: 'account-too-new' };
	const userId = user.id;
	const found = await votable(commentId, userId);
	if (found) return found;
	const [, , [row]] = await db.batch([
		db
			.insert(commentVotes)
			.values({ commentId, userId, value })
			.onConflictDoUpdate({
				target: [commentVotes.commentId, commentVotes.userId],
				set: { value, updatedAt: new Date() }
			}),
		scoreFromVotes(commentId),
		db.select({ score: comments.score }).from(comments).where(eq(comments.id, commentId))
	]);
	return { ok: true, score: row?.score ?? 0, vote: value };
}

/** Removes the reader's vote, if any. */
export async function removeVote(commentId: string, userId: string): Promise<VoteResult> {
	const found = await votable(commentId, userId);
	if (found) return found;
	const [, , [row]] = await db.batch([
		db
			.delete(commentVotes)
			.where(and(eq(commentVotes.commentId, commentId), eq(commentVotes.userId, userId))),
		scoreFromVotes(commentId),
		db.select({ score: comments.score }).from(comments).where(eq(comments.id, commentId))
	]);
	return { ok: true, score: row?.score ?? 0, vote: null };
}
