import { eq, sql } from 'drizzle-orm';
import { db } from '#lib/server/db.ts';
import { sessions, users } from '#db/schema/auth.ts';
import { communityBechdelRatings, communityUmReports, comments } from '#db/schema/community.ts';
import { titles } from '#db/schema/titles.ts';
import { AVATAR_KEYS } from '#lib/media/utils/avatars.ts';
import { umFlagCount } from '#lib/media/utils/metrics.ts';
import type { PublicUser } from '#lib/media/types/user.ts';
import { realEmail } from '#lib/server/auth/placeholder-email.ts';
import { isUniqueViolation } from './db-errors.ts';

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
 * Map a row to the client-safe shape. The real email is used only for the display-name
 * fallback and never copied: it reaches the client on /user/profile alone. A placeholder email
 * (`realEmail` is null) never shows.
 */
export function toPublicUser(row: UserRow): PublicUser {
	return {
		id: row.id,
		username: row.username,
		avatarKey: row.avatarKey,
		role: row.role,
		displayName: row.username || realEmail(row)?.split('@')[0] || 'Account'
	};
}

/** Read-only user lookup by Better Auth user id. */
export async function getUserById(id: string): Promise<UserRow | null> {
	return (await db.query.users.findFirst({ where: eq(users.id, id) })) ?? null;
}

/** The two statements of a ban, for a batch that also logs it (`moderation-queries.ts`). */
export function banStatements(id: string, reason: string | null) {
	return [
		db.update(users).set({ bannedAt: new Date(), banReason: reason }).where(eq(users.id, id)),
		db.delete(sessions).where(eq(sessions.userId, id))
	] as const;
}

/**
 * Bans a user and ends every session they hold, in one batch. The session cookie cache lets a
 * session read as valid for a few minutes, so `locals.getUser` also re-reads `banned_at`; the
 * `session.create` hook (`create-auth.ts`) refuses a new session.
 */
export async function banUser(id: string, reason: string | null): Promise<void> {
	await db.batch(banStatements(id, reason));
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
