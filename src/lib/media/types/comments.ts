import type { getUserComments } from '#lib/server/data/user-queries.ts';
import type { PublicUser } from './user.ts';
import type { commentStatus, moderationSource, reportReason } from '#lib/media/utils/comments.ts';

export type CommentStatus = (typeof commentStatus)[number];
export type ModerationSource = (typeof moderationSource)[number];
export type ReportReason = (typeof reportReason)[number];
export type CommentSort = 'top' | 'new';

/**
 * A comment as the public list shows it, the same for every reader. A comment that is no longer
 * shown (hidden, deleted, or back in review) but still has published replies stays in its thread
 * as a placeholder: `removed`, with no body and no author.
 */
export type CommentView = {
	id: string;
	/** The comment this one answers; null on a root. */
	parentId: string | null;
	/** The thread's root; null on a root. */
	rootId: string | null;
	/** Set on a reply to a reply, for "In reply to name" (linked to the profile when it has a username); null otherwise. */
	inReplyTo: { id: string; displayName: string; username: string | null } | null;
	removed: boolean;
	body: string | null;
	author: PublicUser | null;
	score: number;
	replyCount: number;
	/** ISO timestamps, because the list is cached as JSON. */
	createdAt: string;
	editedAt: string | null;
	/** One rendered level, oldest first; empty on a reply. */
	replies: CommentView[];
};

export type CommentList = {
	comments: CommentView[];
	/** Pass back as `cursor` for the next page; null on the last one. */
	nextCursor: string | null;
};

/**
 * What `GET /api/comments/[id]` answers: the linked comment's thread, a root with its replies.
 * Only the linked comment can be unpublished (it is shown to its author and to staff); every
 * other comment follows the public rules, so an unpublished root is a placeholder. `kind` and
 * `tmdbId` name the title the thread is on, so a page can refuse a link to another title's comment.
 */
export type CommentThread = {
	kind: 'movie' | 'tv';
	tmdbId: number;
	root: CommentView;
	/** Set when the linked comment is not published: its status and the moderation reason. */
	review: { status: Exclude<CommentStatus, 'published'>; reason: string | null } | null;
};

/** The reader's own comment, in any status, as the author sees it. */
export type OwnComment = {
	id: string;
	parentId: string | null;
	rootId: string | null;
	body: string;
	status: CommentStatus;
	moderationSource: ModerationSource | null;
	moderationReason: string | null;
	score: number;
	replyCount: number;
	createdAt: string;
	editedAt: string | null;
};

/** What the viewer endpoint adds to the public list: the reader's votes and unpublished comments. */
export type ViewerCommentState = {
	/** Comment id to the reader's vote. */
	votes: Record<string, 1 | -1>;
	/** Comment id to its current score, for the comments the reader voted on: the cached list trails it. */
	scores: Record<string, number>;
	/** The reader's pending and rejected comments on this title, newest first. */
	comments: OwnComment[];
	/** When the reader's mute ends, while it is in the future; otherwise null. */
	mutedUntil: string | null;
	/** When the reader's votes start counting, while that is in the future; otherwise null. */
	votesOpenAt: string | null;
};

/**
 * One of the reader's comments on `/user/comments`, in any status, with the title it is on:
 * what `getUserComments` returns, with its dates as ISO strings for the load's JSON.
 */
export type UserCommentRow = Omit<
	Awaited<ReturnType<typeof getUserComments>>[number],
	'createdAt' | 'editedAt'
> & { createdAt: string; editedAt: string | null };
