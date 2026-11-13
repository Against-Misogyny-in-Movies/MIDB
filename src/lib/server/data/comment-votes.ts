import { and, eq, sql } from 'drizzle-orm';
import { db } from '#lib/server/db.ts';
import { commentVotes, comments } from '#db/schema/community.ts';
import { titles } from '#db/schema/titles.ts';

/** The title a comment belongs to: what a caller needs to purge its edge-cached list. */
export type VoteTitle = { kind: string; tmdbId: number | null };

export type VoteResult =
	| { ok: true; score: number; vote: 1 | -1 | null; title: VoteTitle }
	| { ok: false; reason: 'not-found' | 'own-comment' };

/** The comment's `score` is set to the sum of its votes, in the same batch as the vote itself. */
const scoreFromVotes = (commentId: string) =>
	db
		.update(comments)
		.set({
			score: sql`(SELECT coalesce(sum(${commentVotes.value}), 0) FROM ${commentVotes} WHERE ${commentVotes.commentId} = ${commentId})`,
			updatedAt: sql`${comments.updatedAt}`
		})
		.where(eq(comments.id, commentId));

/** Only a published comment of someone else's can be voted on. Returns its title, or the refusal. */
async function votable(
	commentId: string,
	userId: string
): Promise<{ title: VoteTitle } | Extract<VoteResult, { ok: false }>> {
	const [row] = await db
		.select({
			userId: comments.userId,
			status: comments.status,
			kind: titles.kind,
			tmdbId: titles.tmdbId
		})
		.from(comments)
		.innerJoin(titles, eq(titles.id, comments.titleId))
		.where(eq(comments.id, commentId));
	if (!row || row.status !== 'published') return { ok: false, reason: 'not-found' };
	if (row.userId === userId) return { ok: false, reason: 'own-comment' };
	return { title: { kind: row.kind, tmdbId: row.tmdbId } };
}

/**
 * Sets the reader's vote on a comment (+1 or -1; a repeated or changed vote rewrites the row).
 * The vote row and the score are one `db.batch`, and the score is recomputed from the votes
 * rather than nudged by a delta, so a repeat, a flip or a concurrent vote cannot leave it wrong.
 * Votes do not bump `updated_at`. The result carries the title, so the endpoint can purge the
 * list's edge cache (`PUBLIC_COMMENTS`) and a reload shows the new score.
 */
export async function setVote(
	commentId: string,
	userId: string,
	value: 1 | -1
): Promise<VoteResult> {
	const found = await votable(commentId, userId);
	if ('ok' in found) return found;
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
	return { ok: true, score: row?.score ?? 0, vote: value, title: found.title };
}

/** Removes the reader's vote, if any. */
export async function removeVote(commentId: string, userId: string): Promise<VoteResult> {
	const found = await votable(commentId, userId);
	if ('ok' in found) return found;
	const [, , [row]] = await db.batch([
		db
			.delete(commentVotes)
			.where(and(eq(commentVotes.commentId, commentId), eq(commentVotes.userId, userId))),
		scoreFromVotes(commentId),
		db.select({ score: comments.score }).from(comments).where(eq(comments.id, commentId))
	]);
	return { ok: true, score: row?.score ?? 0, vote: null, title: found.title };
}
