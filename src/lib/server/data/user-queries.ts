import { and, eq, isNull, sql } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { users } from '$db/schema/auth';
import { communityBechdelRatings, communityUmReports, comments } from '$db/schema/community';
import { titles } from '$db/schema/titles';
import { AVATAR_KEYS } from '$lib/media/utils/avatars';
import { umFlagCount } from '$lib/media/utils/metrics';
import type { PublicUser } from '$lib/media/types/user';
import { isUniqueViolation } from './pg-errors';

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
 * Never bumps updated_at (the backfill pins it past `$onUpdate`); reserve that for profile edits.
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
			.set({ email, updatedAt: sql`${users.updatedAt}` })
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
		const [row] = await db.update(users).set(patch).where(eq(users.id, id)).returning();
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

/** The title fields a history row needs to link back to its detail page. */
const titleRef = { kind: titles.kind, tmdbId: titles.tmdbId, title: titles.title };

/** Comment history for the profile history view, newest first, with the title joined. */
export async function getUserComments(userId: string) {
	return db
		.select({
			id: comments.id,
			body: comments.body,
			status: comments.status,
			createdAt: comments.createdAt,
			...titleRef
		})
		.from(comments)
		.innerJoin(titles, eq(comments.titleId, titles.id))
		.where(eq(comments.userId, userId))
		.orderBy(sql`${comments.createdAt} DESC`);
}

export type UserRating = {
	metric: 'bechdel' | 'unconsenting';
	/** Bechdel rating 0–3, or the number of UM concerns reported. */
	value: number;
	titleId: string;
	kind: (typeof titles.$inferSelect)['kind'];
	tmdbId: number | null;
	title: string;
	updatedAt: Date;
};

/** Community rating history (Bechdel ratings and UM reports), newest first. */
export async function getUserRatings(userId: string): Promise<UserRating[]> {
	const [bechdel, um] = await Promise.all([
		db
			.select({
				rating: communityBechdelRatings.rating,
				titleId: communityBechdelRatings.titleId,
				updatedAt: communityBechdelRatings.updatedAt,
				...titleRef
			})
			.from(communityBechdelRatings)
			.innerJoin(titles, eq(communityBechdelRatings.titleId, titles.id))
			.where(eq(communityBechdelRatings.userId, userId)),
		db
			.select({ report: communityUmReports, ...titleRef })
			.from(communityUmReports)
			.innerJoin(titles, eq(communityUmReports.titleId, titles.id))
			.where(eq(communityUmReports.userId, userId))
	]);

	return [
		...bechdel.map(({ rating, ...rest }) => ({
			metric: 'bechdel' as const,
			value: rating,
			...rest
		})),
		...um.map(({ report, kind, tmdbId, title }) => ({
			metric: 'unconsenting' as const,
			value: umFlagCount(report),
			titleId: report.titleId,
			updatedAt: report.updatedAt,
			kind,
			tmdbId,
			title
		}))
	].sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
}
