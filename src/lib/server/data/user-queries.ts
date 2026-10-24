import { eq, sql } from 'drizzle-orm';
import db from '$db/connections';
import { users } from '$db/schema/auth';
import { communityMetricSubmissions, comments } from '$db/schema/community';
import { movies } from '$db/schema/movie';
import { AVATAR_KEYS } from '$lib/components/user/avatars/avatars';

export type UserRow = typeof users.$inferSelect;
export type UserRole = UserRow['role'];

const USERNAME_RE = /^[a-z0-9_]{3,32}$/;
const RESERVED = new Set([
	'admin', 'administrator', 'moderator', 'mod',
	'midb', 'support', 'staff', 'root',
]);

/**
 * JIT-provision: upsert user on first authed request.
 * Never bumps updated_at — reserve that for real profile edits.
 * COALESCE lets a later email claim backfill a null without clobbering.
 */
export async function getOrCreateUser({ sub, email }: { sub: string; email: string | null }): Promise<UserRow> {
	const [row] = await db
		.insert(users)
		.values({ id: sub, email })
		.onConflictDoUpdate({
			target: users.id,
			set: { email: sql`COALESCE(excluded.email, "user".email)` },
		})
		.returning();
	return row;
}

/** Read-only user lookup by Hanko sub. */
export async function getUserById(id: string): Promise<UserRow | null> {
	return (await db.query.users.findFirst({ where: eq(users.id, id) })) ?? null;
}

type ProfileUpdate = { username?: string; avatarKey?: string };
type ProfileResult = { ok: true; user: UserRow } | { ok: false; reason: string };

/**
 * Update display profile. Validates format, blocklist, and avatar registry.
 * Catches unique-index violation on lower(username) as the race-condition backstop.
 */
export async function updateProfile(id: string, data: ProfileUpdate): Promise<ProfileResult> {
	const patch: ProfileUpdate = {};

	if (data.username !== undefined) {
		const normalized = data.username.toLowerCase();
		if (!USERNAME_RE.test(normalized)) return { ok: false, reason: 'username-format' };
		if (RESERVED.has(normalized)) return { ok: false, reason: 'username-reserved' };
		patch.username = normalized;
	}

	if (data.avatarKey !== undefined) {
		if (!AVATAR_KEYS.has(data.avatarKey)) return { ok: false, reason: 'avatar-invalid' };
		patch.avatarKey = data.avatarKey;
	}

	try {
		const [row] = await db
			.update(users)
			.set({ ...patch, updatedAt: new Date() })
			.where(eq(users.id, id))
			.returning();
		return { ok: true, user: row };
	} catch (e: unknown) {
		if (isUniqueViolation(e)) return { ok: false, reason: 'username-taken' };
		throw e;
	}
}

/**
 * Check username availability (case-insensitive), excluding the requesting user.
 * Used for debounced inline availability check on the profile edit form.
 */
export async function isUsernameAvailable(username: string, excludingId: string): Promise<boolean> {
	const row = await db.query.users.findFirst({
		where: sql`lower(${users.username}) = lower(${username}) AND ${users.id} != ${excludingId}`,
	});
	return !row;
}

/** Comment history for the profile history view, newest first. */
export async function getUserComments(userId: string) {
	return db
		.select()
		.from(comments)
		.where(eq(comments.userId, userId))
		.orderBy(sql`${comments.createdAt} DESC`);
}

/** Metric submission history, newest first, with movie title joined. */
export async function getUserSubmissions(userId: string) {
	return db
		.select({
			submission: communityMetricSubmissions,
			movieTitle: movies.title,
			movieId: movies.id,
		})
		.from(communityMetricSubmissions)
		.leftJoin(movies, eq(communityMetricSubmissions.movieId, movies.id))
		.where(eq(communityMetricSubmissions.userId, userId))
		.orderBy(sql`${communityMetricSubmissions.createdAt} DESC`);
}

function isUniqueViolation(e: unknown): boolean {
	return (
		typeof e === 'object' &&
		e !== null &&
		'code' in e &&
		(e as { code: string }).code === '23505'
	);
}
