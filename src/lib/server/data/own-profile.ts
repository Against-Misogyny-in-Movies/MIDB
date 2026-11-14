import type { UserRow } from '#lib/server/data/user-queries.ts';
import { getUserComments, getUserRatings } from '#lib/server/data/user-queries.ts';
import { activeMute } from '#lib/server/data/mute.ts';
import type { OwnProfile } from '#lib/media/types/profile.ts';

/**
 * What the profile's owner sees beyond the public page: every comment in every status, every
 * community report with what its standing reads from, and the account's mute. Private to the
 * account holder (`GET /api/me/profile`); the dates are ISO strings for the JSON answer.
 */
export async function getOwnProfile(user: Pick<UserRow, 'id' | 'mutedUntil'>): Promise<OwnProfile> {
	const [comments, ratings] = await Promise.all([
		getUserComments(user.id),
		getUserRatings(user.id)
	]);
	return {
		comments: comments.map((row) => ({
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
		})),
		mutedUntil: activeMute(user.mutedUntil)
	};
}
