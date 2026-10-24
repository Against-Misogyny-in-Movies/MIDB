import { and, eq, isNull, sql } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { users } from '$db/schema/auth';
import { communityMetricSubmissions, comments } from '$db/schema/community';
import { movies } from '$db/schema/movie';
import { AVATAR_KEYS } from '$lib/components/user/avatars/avatars';
import type { PublicUser } from '$lib/media/types/user';

export type UserRow = typeof users.$inferSelect;
export type UserRole = UserRow['role'];

const USERNAME_RE = /^[a-z0-9_]{3,32}$/;
const RESERVED = new Set([
	'admin',
	'administrator',
	'moderator',
	'mod',
	'midb',
	'support',
	'staff',
	'root'
]);

/**
 * JIT-provision, read first. Steady state is one primary-key read and zero writes.
 * - Hit: return the row. If its email is null and the claim has one, backfill it once.
 * - Miss: INSERT … ON CONFLICT DO NOTHING; if a concurrent first request won the race,
 *   nothing is returned, so read the row it wrote.
 * Never bumps updated_at — reserve that for real profile edits.
 */
export async function getOrCreateUser({
	sub,
	email
}: {
	sub: string;
	email: string | null;
}): Promise<UserRow> {
	const existing = await getUserById(sub);
	if (existing) {
		if (existing.email !== null || !email) return existing;
		const [updated] = await db
			.update(users)
			.set({ email })
			.where(and(eq(users.id, sub), isNull(users.email)))
			.returning();
		return updated ?? existing;
	}

	const [inserted] = await db
		.insert(users)
		.values({ id: sub, email })
		.onConflictDoNothing({ target: users.id })
		.returning();
	if (inserted) return inserted;

	const raced = await getUserById(sub);
	if (!raced) throw new Error(`getOrCreateUser: user ${sub} missing after insert conflict`);
	return raced;
}

/**
 * Map a row to the client-safe shape. The email is used only for the display-name
 * fallback and never copied: it reaches the client on /user/profile alone.
 */
export function toPublicUser(row: UserRow): PublicUser {
	return {
		username: row.username,
		avatarKey: row.avatarKey,
		role: row.role,
		displayName: row.username || row.email?.split('@')[0] || 'Account'
	};
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
		where: sql`lower(${users.username}) = lower(${username}) AND ${users.id} != ${excludingId}`
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
			movieId: movies.id
		})
		.from(communityMetricSubmissions)
		.leftJoin(movies, eq(communityMetricSubmissions.movieId, movies.id))
		.where(eq(communityMetricSubmissions.userId, userId))
		.orderBy(sql`${communityMetricSubmissions.createdAt} DESC`);
}

/** Postgres 23505. Drizzle wraps driver errors in DrizzleQueryError, so check `cause` too. */
function isUniqueViolation(e: unknown): boolean {
	for (
		let err = e;
		typeof err === 'object' && err !== null;
		err = (err as { cause?: unknown }).cause
	) {
		if ((err as { code?: unknown }).code === '23505') return true;
	}
	return false;
}
