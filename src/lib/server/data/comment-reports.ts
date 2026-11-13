import { and, eq, sql } from 'drizzle-orm';
import { db } from '#lib/server/db.ts';
import { commentReports, comments } from '#db/schema/community.ts';
import type { CommentStatus, ReportReason } from '#lib/media/types/comments.ts';
import { REPORT_THRESHOLD } from '#lib/media/utils/comments.ts';
import { getCommentWithTitle, type CommentWithTitle } from './comment-queries.ts';
import { replyAuthorsAffected } from './comment-reply-authors.ts';
import { runBatch, statusMove } from './comment-status.ts';

export type ReportResult =
	| {
			ok: true;
			/** True when this reader had already reported the comment (in any report status); nothing was stored. */
			alreadyReported: boolean;
			/** The comment's status afterwards: `pending` once the report threshold is reached. */
			status: CommentStatus;
			title: CommentWithTitle['title'];
			/** The comment's author, whose public profile lists it while it is published. */
			authorId: string;
			/** The authors of its published replies, whose profiles name it, when the report sent it to review. */
			replyAuthorIds: string[];
	  }
	| { ok: false; reason: 'not-found' | 'own-comment' };

/**
 * Stores a reader's report of a published comment. When this makes `REPORT_THRESHOLD` distinct
 * open reports, the comment moves to `pending` (source `reports`) in the same batch, with its
 * thread's reply counts adjusted. One report per reader per comment, whatever its status: a
 * reader whose earlier report was resolved or dismissed cannot report the comment again, and
 * the second request is ignored.
 */
export async function reportComment(input: {
	commentId: string;
	reporterId: string;
	reason: ReportReason;
	note?: string | null;
}): Promise<ReportResult> {
	const { commentId, reporterId, reason, note } = input;
	const found = await getCommentWithTitle(commentId);
	if (!found || found.comment.status !== 'published') return { ok: false, reason: 'not-found' };
	if (found.comment.userId === reporterId) return { ok: false, reason: 'own-comment' };

	const replyAuthorIds = await replyAuthorsAffected(commentId, 'published', 'pending');
	const [existing] = await db
		.select({ id: commentReports.id })
		.from(commentReports)
		.where(and(eq(commentReports.commentId, commentId), eq(commentReports.reporterId, reporterId)));
	if (!existing) {
		await runBatch([
			db
				.insert(commentReports)
				.values({ commentId, reporterId, reason, note: note || null })
				.onConflictDoNothing(),
			...statusMove(
				commentId,
				'published',
				'pending',
				{ moderationSource: 'reports', moderationReason: 'Reported by readers' },
				sql`(SELECT count(*) FROM ${commentReports} WHERE ${commentReports.commentId} = ${commentId} AND ${commentReports.status} = 'open') >= ${REPORT_THRESHOLD}`
			)
		]);
	}
	const [after] = await db
		.select({ status: comments.status })
		.from(comments)
		.where(eq(comments.id, commentId));
	return {
		ok: true,
		alreadyReported: Boolean(existing),
		status: after?.status ?? found.comment.status,
		title: found.title,
		authorId: found.comment.userId,
		replyAuthorIds: (after?.status ?? 'published') === 'published' ? [] : replyAuthorIds
	};
}
