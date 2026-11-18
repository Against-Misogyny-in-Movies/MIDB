import { and, eq, gt } from 'drizzle-orm';
import { db } from '#lib/server/db.ts';
import { comments } from '#db/schema/community.ts';
import type { UserRow } from '#lib/server/data/user-queries.ts';
import { getUserComments, getUserRatings } from '#lib/server/data/user-queries.ts';
import { activeMute } from '#lib/server/data/mute.ts';
import type { OwnProfile } from '#lib/media/types/profile.ts';

/**
 * What the profile's owner sees beyond the public page, as additions to its lists: the comments
 * that are not published and the community reports that do not count (with what their standing
 * reads from), the reply counts of the published comments that have replies (for their delete
 * confirmation), and the account's mute. Private to the account holder
 * (`GET /api/me/profile`); the dates are ISO strings for the JSON answer.
 */
export async function getOwnProfile(user: Pick<UserRow, 'id' | 'mutedUntil'>): Promise<OwnProfile> {
	const [unpublished, ratings, replied] = await Promise.all([
		getUserComments(user.id, { notPublic: true }),
		getUserRatings(user.id, { notCounted: true }),
		db
			.select({ id: comments.id, replyCount: comments.replyCount })
			.from(comments)
			.where(
				and(
					eq(comments.userId, user.id),
					eq(comments.status, 'published'),
					gt(comments.replyCount, 0)
				)
			)
	]);
	return {
		notPublic: {
			comments: unpublished.map((row) => ({
				...row,
				createdAt: row.createdAt.toISOString(),
				editedAt: row.editedAt?.toISOString() ?? null
			})),
			reports: ratings.map((row) => ({
				titleId: row.titleId,
				status: row.status,
				kind: row.kind,
				tmdbId: row.tmdbId,
				title: row.title,
				updatedAt: row.updatedAt.toISOString(),
				countsFrom: row.countsFrom.toISOString(),
				restricted: row.restricted
			}))
		},
		replyCounts: Object.fromEntries(replied.map((row) => [row.id, row.replyCount])),
		mutedUntil: activeMute(user.mutedUntil)
	};
}
