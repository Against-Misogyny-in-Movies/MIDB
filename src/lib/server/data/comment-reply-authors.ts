import { and, eq } from 'drizzle-orm';
import { db } from '#lib/server/db.ts';
import { comments } from '#db/schema/community.ts';
import type { CommentStatus } from '#lib/media/types/comments.ts';

/**
 * The authors of a comment's published direct replies, when the comment moved into or out of
 * `published`: a reply's public profile names the published comment it answers ("In reply to"),
 * so those profiles change with the parent's status. Any other move changes none, and reads
 * nothing.
 */
export async function replyAuthorsAffected(
	commentId: string,
	from: CommentStatus,
	to: CommentStatus
): Promise<string[]> {
	if ((from === 'published') === (to === 'published')) return [];
	const rows = await db
		.selectDistinct({ userId: comments.userId })
		.from(comments)
		.where(and(eq(comments.parentId, commentId), eq(comments.status, 'published')));
	return rows.map((row) => row.userId);
}
