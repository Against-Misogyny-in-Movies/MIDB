import { and, desc, eq, lt, or, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/sqlite-core';
import { db } from '#lib/server/db.ts';
import { users } from '#db/schema/auth.ts';
import { communityContentReports as reports, comments } from '#db/schema/community.ts';
import { titles } from '#db/schema/titles.ts';
import type {
	ProfileComment,
	ProfileCommentPage,
	ProfileReport,
	ProfileReportPage,
	PublicProfile
} from '#lib/media/types/profile.ts';
import { USERNAME_LOOKUP_RE } from '#lib/media/utils/username.ts';
import { COMMENT_PAGE_SIZE, afterCursor, decodeCursor, encodeCursor } from './comment-queries.ts';
import { displayNameOf } from './user-queries.ts';
import { publicTime } from './public-time.ts';
import { countedReportsWhere } from './community-reports.ts';

/** What an account's public profile reads of its user row: enough to show and to cache it, nothing private. */
type ProfileOwner = Pick<typeof users.$inferSelect, 'id' | 'avatarKey' | 'role' | 'createdAt'> & {
	username: string;
};

/**
 * The account behind a public profile address: matched case-insensitively on the username. An
 * address that is not a possible username, no match, and a banned or deleted account are all null, as is an
 * account without a username (it has no address).
 */
export async function findProfileOwner(username: string): Promise<ProfileOwner | null> {
	const lower = username.toLowerCase();
	if (!USERNAME_LOOKUP_RE.test(lower)) return null;
	const [row] = await db
		.select({
			id: users.id,
			username: users.username,
			avatarKey: users.avatarKey,
			role: users.role,
			createdAt: users.createdAt
		})
		.from(users)
		.where(
			and(
				eq(sql`lower(${users.username})`, lower),
				sql`${users.bannedAt} IS NULL AND ${users.deletedAt} IS NULL`
			)
		)
		.limit(1);
	return row && row.username !== null ? { ...row, username: row.username } : null;
}

const parent = alias(comments, 'parent');
const parentAuthor = alias(users, 'parent_author');

/**
 * One page of an account's published comments, newest first, each with its title and, for a
 * reply, the author of the published comment it answers. Cursor-paged like the title list
 * (`decodeCursor`, sort `new`); a cursor this module did not make reads as the first page. The
 * moderation reason and every unpublished comment stay out.
 */
export async function getProfileComments(
	userId: string,
	cursor?: string | null,
	limit: number = COMMENT_PAGE_SIZE
): Promise<ProfileCommentPage> {
	const after = decodeCursor(cursor, 'new');
	const rows = await db
		.select({
			comment: comments,
			kind: titles.kind,
			tmdbId: titles.tmdbId,
			titleName: titles.title,
			parentStatus: parent.status,
			parentName: parentAuthor.username
		})
		.from(comments)
		.innerJoin(titles, eq(comments.titleId, titles.id))
		.leftJoin(parent, eq(comments.parentId, parent.id))
		.leftJoin(parentAuthor, eq(parent.userId, parentAuthor.id))
		.where(
			and(
				eq(comments.userId, userId),
				eq(comments.status, 'published'),
				after ? afterCursor('new', after) : undefined
			)
		)
		.orderBy(desc(comments.createdAt), desc(comments.id))
		.limit(limit + 1);

	const page = rows.slice(0, limit);
	return {
		comments: page.map(
			({ comment, kind, tmdbId, titleName, parentStatus, parentName }): ProfileComment => ({
				id: comment.id,
				body: comment.body,
				score: comment.score,
				createdAt: publicTime(comment.createdAt),
				edited: comment.editedAt !== null,
				title: { kind, tmdbId, name: titleName },
				inReplyTo:
					parentStatus === 'published'
						? { displayName: displayNameOf(parentName), username: parentName }
						: null
			})
		),
		nextCursor: rows.length > limit ? encodeCursor(page[page.length - 1].comment, 'new') : null
	};
}

/** Where a page of reports resumes: the last row's `updated_at` (ms) and title id. */
type ReportCursor = { updatedAt: number; titleId: string };

function encodeReportCursor(row: { updatedAt: Date; titleId: string }): string {
	return `${row.updatedAt.getTime()}.${row.titleId}`;
}

/** Null for a cursor that is not one this module made: the first page. */
function decodeReportCursor(cursor: string | null | undefined): ReportCursor | null {
	const match = cursor ? /^(\d+)\.([\w-]+)$/.exec(cursor) : null;
	if (!match) return null;
	const updatedAt = Number(match[1]);
	// A digit string past the range of a date reads as an invalid cursor.
	if (!Number.isFinite(new Date(updatedAt).getTime())) return null;
	return { updatedAt, titleId: match[2] };
}

/**
 * One page of the account's reports that count, newest first by `updated_at`, then title id
 * (one report per account and title, so the pair is unique and the order is stable for a
 * cursor). The rule is `countedReportsWhere`, the one a title's counts use, so a held or
 * rejected report, a report of an account that is too new, muted or banned, never shows.
 */
export async function getProfileReports(
	userId: string,
	cursor?: string | null,
	limit: number = COMMENT_PAGE_SIZE
): Promise<ProfileReportPage> {
	const after = decodeReportCursor(cursor);
	const at = after ? new Date(after.updatedAt) : null;
	const rows = await db
		.select({
			kind: titles.kind,
			tmdbId: titles.tmdbId,
			name: titles.title,
			titleId: reports.titleId,
			updatedAt: reports.updatedAt
		})
		.from(reports)
		.innerJoin(users, eq(reports.userId, users.id))
		.innerJoin(titles, eq(reports.titleId, titles.id))
		.where(
			and(
				eq(reports.userId, userId),
				countedReportsWhere(),
				at && after
					? or(
							lt(reports.updatedAt, at),
							and(eq(reports.updatedAt, at), lt(reports.titleId, after.titleId))
						)
					: undefined
			)
		)
		.orderBy(desc(reports.updatedAt), desc(reports.titleId))
		.limit(limit + 1);
	const page = rows.slice(0, limit);
	return {
		reports: page.map(({ kind, tmdbId, name }): ProfileReport => ({ kind, tmdbId, name })),
		nextCursor: rows.length > limit ? encodeReportCursor(page[page.length - 1]) : null
	};
}

/** The titles the account's published comments and counted reports are on: each title once, across both. */
async function getTitleCount(userId: string): Promise<number> {
	const commentTitles = db
		.select({ titleId: comments.titleId })
		.from(comments)
		.where(and(eq(comments.userId, userId), eq(comments.status, 'published')));
	const reportTitles = db
		.select({ titleId: reports.titleId })
		.from(reports)
		.innerJoin(users, eq(reports.userId, users.id))
		.where(and(eq(reports.userId, userId), countedReportsWhere()));
	const distinct = commentTitles.union(reportTitles).as('profile_titles');
	const [row] = await db.select({ count: sql<number>`count(*)` }).from(distinct);
	return row?.count ?? 0;
}

/** How many reports of the account count: the figure the profile shows, since its list is paged. */
async function getReportCount(userId: string): Promise<number> {
	const [row] = await db
		.select({ count: sql<number>`count(*)` })
		.from(reports)
		.innerJoin(users, eq(reports.userId, users.id))
		.where(and(eq(reports.userId, userId), countedReportsWhere()));
	return row?.count ?? 0;
}

/** The number of an account's published comments and the sum of their scores. */
async function getCommentStats(userId: string): Promise<{ count: number; scoreTotal: number }> {
	const [row] = await db
		.select({
			count: sql<number>`count(*)`,
			scoreTotal: sql<number>`coalesce(sum(${comments.score}), 0)`
		})
		.from(comments)
		.where(and(eq(comments.userId, userId), eq(comments.status, 'published')));
	return { count: row?.count ?? 0, scoreTotal: row?.scoreTotal ?? 0 };
}

/**
 * An account's public profile, found by username (case-insensitive); null for an address with
 * no account, a banned or deleted account or an account without a username. Read-only.
 */
export async function getPublicProfile(username: string): Promise<PublicProfile | null> {
	const owner = await findProfileOwner(username);
	if (!owner) return null;
	const [stats, commentPage, reportPage, reportCount, titleCount] = await Promise.all([
		getCommentStats(owner.id),
		getProfileComments(owner.id),
		getProfileReports(owner.id),
		getReportCount(owner.id),
		getTitleCount(owner.id)
	]);
	return {
		id: owner.id,
		username: owner.username,
		avatarKey: owner.avatarKey,
		staffRole: owner.role === 'user' ? null : owner.role,
		joinedAt: owner.createdAt.toISOString().slice(0, 10),
		scoreTotal: stats.scoreTotal,
		commentCount: stats.count,
		reportCount,
		titleCount,
		comments: commentPage,
		reports: reportPage
	};
}
