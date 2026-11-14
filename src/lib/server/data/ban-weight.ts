import { alias } from 'drizzle-orm/sqlite-core';
import { and, eq, inArray, sql } from 'drizzle-orm';
import { db } from '#lib/server/db.ts';
import { commentVotes, comments } from '#db/schema/community.ts';
import { titles } from '#db/schema/titles.ts';
import type { BatchStatement } from './comment-status.ts';

/** The reason the hidden comments of a ban carry. */
const BAN_COMMENT_REASON = 'Account banned';

/**
 * What a ban changes that the edge caches show: the titles whose lists lose a hidden comment
 * or a vote, and the profiles of the authors whose scores change and of the authors of the
 * published replies to a hidden comment. Read before the ban's batch runs.
 */
export async function banReach(targetId: string) {
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
 * The statements that take a banned account's weight away, for the ban's batch (atomic), in an
 * order that matters: the reply counts of the parents and roots of its published comments drop
 * by the number of those comments they hold, the score of every comment it voted on is
 * recomputed without its votes, the votes are deleted, and its published and pending comments
 * become `hidden` (source `moderator`, reason "Account banned"). They select by the account's
 * id, so no id list is bound.
 */
export function banWeightStatements(targetId: string): BatchStatement[] {
	const publishedOfTarget = sql`SELECT parent_id FROM comments WHERE user_id = ${targetId} AND status = 'published' UNION SELECT root_id FROM comments WHERE user_id = ${targetId} AND status = 'published'`;
	return [
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
			.where(and(eq(comments.userId, targetId), inArray(comments.status, ['published', 'pending'])))
	];
}
