import { and, asc, desc, eq, gt, inArray, isNull, lt, or, type SQL } from 'drizzle-orm';
import { chunkForD1 } from '#db/lib/chunkForD1.ts';
import { db } from '#lib/server/db.ts';
import { users } from '#db/schema/auth.ts';
import { commentVotes, comments } from '#db/schema/community.ts';
import { titles } from '#db/schema/titles.ts';
import type {
	CommentList,
	CommentSort,
	CommentView,
	OwnComment,
	ViewerCommentState
} from '#lib/media/types/comments.ts';
import { decideStatus } from '#lib/server/moderation/decide.ts';
import { activeMute } from './mute.ts';
import { toPublicUser } from './user-queries.ts';
import type { TitleKind, TitleRow } from './title-queries.ts';
import {
	countNewReply,
	runBatch,
	runMove,
	statusMove,
	type BatchStatement
} from './comment-status.ts';

export type CommentRow = typeof comments.$inferSelect;

/** Roots per page of the public list. */
export const COMMENT_PAGE_SIZE = 20;

/** Published comments, plus any other one that still has published replies (shown as a placeholder). */
const shown = or(eq(comments.status, 'published'), gt(comments.replyCount, 0));

type CursorParts = { score: number | null; createdAt: number; id: string };

function encodeCursor(row: CommentRow, sort: CommentSort): string {
	const time = row.createdAt.getTime();
	return sort === 'top' ? `${row.score}.${time}.${row.id}` : `${time}.${row.id}`;
}

/** Null for a cursor that is not one this module made, which reads as the first page. */
function decodeCursor(cursor: string | null | undefined, sort: CommentSort): CursorParts | null {
	if (!cursor) return null;
	const match =
		sort === 'top' ? /^(-?\d+)\.(\d+)\.([\w-]+)$/.exec(cursor) : /^()(\d+)\.([\w-]+)$/.exec(cursor);
	if (!match) return null;
	const createdAt = Number(match[2]);
	// A digit string past the range of a date reads as an invalid cursor.
	if (!Number.isFinite(new Date(createdAt).getTime())) return null;
	return { score: sort === 'top' ? Number(match[1]) : null, createdAt, id: match[3] };
}

function afterCursor(sort: CommentSort, cursor: CursorParts): SQL | undefined {
	const at = new Date(cursor.createdAt);
	const older = or(
		lt(comments.createdAt, at),
		and(eq(comments.createdAt, at), lt(comments.id, cursor.id))
	);
	if (sort === 'new' || cursor.score === null) return older;
	return or(lt(comments.score, cursor.score), and(eq(comments.score, cursor.score), older));
}

type ListedRow = { comment: CommentRow; author: typeof users.$inferSelect };

function toView(
	{ comment, author }: ListedRow,
	authors: Map<string, ListedRow>,
	replies: CommentView[] = []
): CommentView {
	const removed = comment.status !== 'published';
	const parent =
		comment.parentId && comment.parentId !== comment.rootId ? authors.get(comment.parentId) : null;
	return {
		id: comment.id,
		parentId: comment.parentId,
		rootId: comment.rootId,
		inReplyTo:
			parent && parent.comment.status === 'published'
				? { id: parent.comment.id, displayName: toPublicUser(parent.author).displayName }
				: null,
		removed,
		body: removed ? null : comment.body,
		author: removed ? null : toPublicUser(author),
		score: removed ? 0 : comment.score,
		replyCount: comment.replyCount,
		createdAt: comment.createdAt.toISOString(),
		editedAt: removed ? null : (comment.editedAt?.toISOString() ?? null),
		replies
	};
}

/**
 * One page of a title's public list: published roots (a root that is not published but has
 * published replies comes back as a placeholder) in `sort` order, each with its thread's
 * published replies oldest first. Pending and rejected comments never appear; a placeholder
 * carries no body and no author. Read-only, and the same for every reader.
 */
export async function listTitleComments(
	titleId: string,
	{
		sort,
		cursor,
		limit = COMMENT_PAGE_SIZE
	}: { sort: CommentSort; cursor?: string | null; limit?: number }
): Promise<CommentList> {
	const after = decodeCursor(cursor, sort);
	const order =
		sort === 'top'
			? [desc(comments.score), desc(comments.createdAt), desc(comments.id)]
			: [desc(comments.createdAt), desc(comments.id)];
	const page = await db
		.select({ comment: comments, author: users })
		.from(comments)
		.innerJoin(users, eq(comments.userId, users.id))
		.where(
			and(
				eq(comments.titleId, titleId),
				isNull(comments.parentId),
				shown,
				after ? afterCursor(sort, after) : undefined
			)
		)
		.orderBy(...order)
		.limit(limit + 1);

	const hasMore = page.length > limit;
	const roots = page.slice(0, limit);

	const replyRows: ListedRow[] = [];
	for (const ids of chunkForD1(
		roots.map((r) => r.comment.id),
		1,
		2
	)) {
		replyRows.push(
			...(await db
				.select({ comment: comments, author: users })
				.from(comments)
				.innerJoin(users, eq(comments.userId, users.id))
				.where(and(inArray(comments.rootId, ids), shown))
				.orderBy(asc(comments.createdAt), asc(comments.id)))
		);
	}

	const byId = new Map<string, ListedRow>();
	for (const row of [...roots, ...replyRows]) byId.set(row.comment.id, row);
	const repliesOf = new Map<string, CommentView[]>();
	for (const row of replyRows) {
		const rootId = row.comment.rootId as string;
		repliesOf.set(rootId, [...(repliesOf.get(rootId) ?? []), toView(row, byId)]);
	}

	return {
		comments: roots.map((row) => toView(row, byId, repliesOf.get(row.comment.id) ?? [])),
		nextCursor: hasMore ? encodeCursor(roots[roots.length - 1].comment, sort) : null
	};
}

export function toOwnComment(row: CommentRow): OwnComment {
	return {
		id: row.id,
		parentId: row.parentId,
		rootId: row.rootId,
		body: row.body,
		status: row.status,
		moderationSource: row.moderationSource,
		moderationReason: row.moderationReason,
		score: row.score,
		replyCount: row.replyCount,
		createdAt: row.createdAt.toISOString(),
		editedAt: row.editedAt?.toISOString() ?? null
	};
}

/**
 * What only the signed-in reader sees on a title: their votes on its comments with those
 * comments' current scores (the cached list trails them), and their own
 * pending and rejected comments (the public list leaves those out). Never cached.
 */
export async function getViewerCommentState(
	titleId: string,
	user: { id: string; mutedUntil: Date | null }
): Promise<ViewerCommentState> {
	const userId = user.id;
	const [votes, own] = await Promise.all([
		db
			.select({
				commentId: commentVotes.commentId,
				value: commentVotes.value,
				score: comments.score
			})
			.from(commentVotes)
			.innerJoin(comments, eq(commentVotes.commentId, comments.id))
			.where(and(eq(commentVotes.userId, userId), eq(comments.titleId, titleId))),
		db
			.select()
			.from(comments)
			.where(
				and(
					eq(comments.titleId, titleId),
					eq(comments.userId, userId),
					inArray(comments.status, ['pending', 'rejected'])
				)
			)
			.orderBy(desc(comments.createdAt), desc(comments.id))
	]);
	return {
		votes: Object.fromEntries(votes.map((v) => [v.commentId, v.value === 1 ? 1 : -1])),
		scores: Object.fromEntries(votes.map((v) => [v.commentId, v.score])),
		comments: own.map(toOwnComment),
		mutedUntil: activeMute(user.mutedUntil)
	};
}

/** A comment with the title it belongs to, for the endpoints that act on a comment by id. */
export type CommentWithTitle = {
	comment: CommentRow;
	title: { id: string; kind: TitleKind; tmdbId: number | null; name: string };
};

export async function getCommentWithTitle(id: string): Promise<CommentWithTitle | null> {
	const [row] = await db
		.select({ comment: comments, title: titles })
		.from(comments)
		.innerJoin(titles, eq(comments.titleId, titles.id))
		.where(eq(comments.id, id))
		.limit(1);
	if (!row) return null;
	return {
		comment: row.comment,
		title: {
			id: row.title.id,
			kind: row.title.kind,
			tmdbId: row.title.tmdbId,
			name: row.title.title
		}
	};
}

type WriteFailure = 'not-found' | 'forbidden' | 'not-editable' | 'parent-not-found' | 'conflict';
export type CommentWrite =
	| { ok: true; comment: OwnComment; title: CommentWithTitle['title'] }
	| { ok: false; reason: WriteFailure };

/**
 * Stores a new comment. Its status comes from `decideStatus`. A reply must answer a published
 * comment of the same title; a reply to a reply is filed under the thread's root and keeps the
 * comment it answers as `parent_id`. The insert and the reply counts are one batch.
 */
export async function createComment(input: {
	title: TitleRow;
	userId: string;
	body: string;
	parentId?: string | null;
}): Promise<CommentWrite> {
	const { title, userId, body } = input;
	let parent: CommentRow | null = null;
	if (input.parentId) {
		[parent = null] = await db
			.select()
			.from(comments)
			.where(and(eq(comments.id, input.parentId), eq(comments.titleId, title.id)))
			.limit(1);
		if (!parent || parent.status !== 'published') return { ok: false, reason: 'parent-not-found' };
	}

	const decision = await decideStatus({
		body,
		titleName: title.title,
		kind: title.kind,
		parentBody: parent?.body
	});
	const id = crypto.randomUUID();
	const rootId = parent ? (parent.rootId ?? parent.id) : null;
	const statements: BatchStatement[] = [
		db.insert(comments).values({
			id,
			titleId: title.id,
			userId,
			parentId: parent?.id ?? null,
			rootId,
			body,
			status: decision.status,
			moderationSource: decision.source,
			moderationReason: decision.reason,
			aiVerdict: decision.aiVerdict
		})
	];
	if (parent && rootId && decision.status === 'published') {
		statements.push(...countNewReply(parent.id, rootId));
	}
	await runBatch(statements);

	const [stored] = await db.select().from(comments).where(eq(comments.id, id));
	return {
		ok: true,
		comment: toOwnComment(stored),
		title: { id: title.id, kind: title.kind, tmdbId: title.tmdbId, name: title.title }
	};
}

/**
 * The author edits a comment: the body changes, `edited_at` is set and moderation runs again,
 * so a published comment goes back through `decideStatus`. A hidden or deleted comment cannot be
 * edited, which keeps an author from reviving what a moderator removed. A comment that left
 * the status the edit read (a moderator acted meanwhile) answers `conflict`.
 */
export async function editComment(id: string, userId: string, body: string): Promise<CommentWrite> {
	const found = await getCommentWithTitle(id);
	if (!found) return { ok: false, reason: 'not-found' };
	const { comment, title } = found;
	if (comment.userId !== userId) return { ok: false, reason: 'forbidden' };
	if (comment.status === 'hidden' || comment.status === 'deleted') {
		return { ok: false, reason: 'not-editable' };
	}
	if (body === comment.body) return { ok: true, comment: toOwnComment(comment), title };

	let parentBody: string | undefined;
	if (comment.parentId) {
		const [parent] = await db
			.select({ body: comments.body, status: comments.status })
			.from(comments)
			.where(eq(comments.id, comment.parentId));
		// A hidden or deleted parent's text is withheld from the model, as it is from readers.
		if (parent?.status === 'published') parentBody = parent.body;
	}
	const decision = await decideStatus({
		body,
		titleName: title.name,
		kind: title.kind,
		parentBody
	});
	const moved = await runMove(
		statusMove(comment.id, comment.status, decision.status, {
			body,
			editedAt: new Date(),
			moderationSource: decision.source,
			moderationReason: decision.reason,
			aiVerdict: decision.aiVerdict
		})
	);
	if (!moved) return { ok: false, reason: 'conflict' };
	const [stored] = await db.select().from(comments).where(eq(comments.id, id));
	return { ok: true, comment: toOwnComment(stored), title };
}

/**
 * The author deletes a comment. It stays in the table as `deleted`, so replies keep their
 * thread; the public list shows a bodiless placeholder when it has published replies. A
 * comment a moderator moved meanwhile answers `conflict`.
 */
export async function softDeleteComment(
	id: string,
	userId: string
): Promise<{ ok: true; title: CommentWithTitle['title'] } | { ok: false; reason: WriteFailure }> {
	const found = await getCommentWithTitle(id);
	if (!found || found.comment.status === 'deleted') return { ok: false, reason: 'not-found' };
	if (found.comment.userId !== userId) return { ok: false, reason: 'forbidden' };
	if (!(await runMove(statusMove(id, found.comment.status, 'deleted')))) {
		return { ok: false, reason: 'conflict' };
	}
	return { ok: true, title: found.title };
}
