import { desc, eq, sql } from 'drizzle-orm';
import { db } from '#lib/server/db.ts';
import { sessions, users } from '#db/schema/auth.ts';
import { communityContentReports, comments } from '#db/schema/community.ts';
import { titles } from '#db/schema/titles.ts';
import { AVATAR_KEYS } from '#lib/media/utils/avatars.ts';
import { USERNAME_RE } from '#lib/media/utils/username.ts';
import type { PublicUser } from '#lib/media/types/user.ts';
import { isUniqueViolation } from './db-errors.ts';

export type UserRow = typeof users.$inferSelect;
export type UserRole = UserRow['role'];

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
 * Map a row to the client-safe shape. The email is never copied: it reaches the client on
 * /user/profile alone. Every account has a generated or chosen username, which is its display
 * name; only a row with none shows "Account".
 */
export function toPublicUser(row: UserRow): PublicUser {
	return {
		id: row.id,
		username: row.username,
		avatarKey: row.avatarKey,
		role: row.role,
		displayName: row.username || 'Account'
	};
}

/** Read-only user lookup by Better Auth user id. */
export async function getUserById(id: string): Promise<UserRow | null> {
	return (await db.query.users.findFirst({ where: eq(users.id, id) })) ?? null;
}

/** The two statements of a ban, for a batch that also logs it (`moderation-actions.ts`). */
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

/**
 * A reader's comments for the history page, newest first, in every status (the page badges
 * each one), with the title joined.
 */
export async function getUserComments(userId: string) {
	return db
		.select({
			id: comments.id,
			body: comments.body,
			status: comments.status,
			moderationReason: comments.moderationReason,
			parentId: comments.parentId,
			replyCount: comments.replyCount,
			createdAt: comments.createdAt,
			editedAt: comments.editedAt,
			...titleRef
		})
		.from(comments)
		.innerJoin(titles, eq(comments.titleId, titles.id))
		.where(eq(comments.userId, userId))
		.orderBy(desc(comments.createdAt), desc(comments.id));
}

export type UserRating = {
	status: (typeof communityContentReports.$inferSelect)['status'];
	titleId: string;
	kind: (typeof titles.$inferSelect)['kind'];
	tmdbId: number | null;
	title: string;
	updatedAt: Date;
};

/** A reader's reader reports, newest first, in every status, with the title joined. */
export async function getUserRatings(userId: string): Promise<UserRating[]> {
	return db
		.select({
			status: communityContentReports.status,
			titleId: communityContentReports.titleId,
			updatedAt: communityContentReports.updatedAt,
			...titleRef
		})
		.from(communityContentReports)
		.innerJoin(titles, eq(communityContentReports.titleId, titles.id))
		.where(eq(communityContentReports.userId, userId))
		.orderBy(desc(communityContentReports.updatedAt), desc(communityContentReports.titleId));
}
