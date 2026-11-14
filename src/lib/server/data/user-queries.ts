import { desc, eq } from 'drizzle-orm';
import { db } from '#lib/server/db.ts';
import { retiredUsernames, sessions, users } from '#db/schema/auth.ts';
import { communityContentReports, comments } from '#db/schema/community.ts';
import { titles } from '#db/schema/titles.ts';
import { AVATAR_KEYS } from '#lib/media/utils/avatars.ts';
import { USERNAME_CHANGE_WAIT_DAYS, NEW_USERNAME_RE } from '#lib/media/utils/username.ts';
import { isStaff } from '#lib/media/utils/staff.ts';
import { DAY_MS } from '#lib/media/utils/time.ts';
import { isTakenByOthers } from './username-taken.ts';
import { usernameRefusal } from '#lib/server/moderation/username-check.ts';
import type { PublicUser } from '#lib/media/types/user.ts';
import { isUniqueViolation } from './db-errors.ts';
import { activeMute } from './mute.ts';
import { countsFromDate } from './counting-account.ts';

export type UserRow = typeof users.$inferSelect;
export type UserRole = UserRow['role'];

/** The name shown for an account: its username, or "Account" for a row with none. */
export function displayNameOf(username: string | null | undefined): string {
	return username || 'Account';
}

/**
 * Map a row to the client-safe shape. The email is never copied: it reaches the client on
 * /user/settings alone. Every account has a generated or chosen username, which is its display
 * name; only a row with none shows "Account".
 */
export function toPublicUser(row: UserRow): PublicUser {
	return {
		id: row.id,
		username: row.username,
		avatarKey: row.avatarKey,
		role: row.role,
		displayName: displayNameOf(row.username)
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
 * Update display profile. Refuses a muted account, then validates the avatar registry and, only
 * when the username changes, its format, the reserved names and the comment blocklist (a stored
 * name is never checked again). A rename waits `USERNAME_CHANGE_WAIT_DAYS`
 * after the last one (staff and the first rename are exempt) and cannot take a name, or a
 * look-alike of one, that another account holds or retired in the last `RETIRED_USERNAME_DAYS`;
 * the old name is retired in the same batch.
 * Catches unique-index violation on lower(username) as the race-condition backstop.
 */
export async function updateProfile(id: string, data: ProfileUpdate): Promise<ProfileResult> {
	const current = await getUserById(id);
	if (!current) return { ok: false, reason: 'no-account' };
	if (activeMute(current.mutedUntil)) return { ok: false, reason: 'muted' };

	const patch: ProfileUpdate = {};
	let renamed = false;

	if (data.username !== undefined) {
		const normalized = data.username.toLowerCase();
		renamed = normalized !== current.username?.toLowerCase();
		// A name already stored is not checked again: only a rename meets the shape, reserved and
		// blocklist rules, so an account with an older name still saves its avatar.
		if (renamed) {
			if (!NEW_USERNAME_RE.test(normalized)) return { ok: false, reason: 'username-format' };
			const refusal = usernameRefusal(normalized);
			if (refusal) return { ok: false, reason: `username-${refusal}` };
			const waitEnds = current.usernameChangedAt
				? current.usernameChangedAt.getTime() + USERNAME_CHANGE_WAIT_DAYS * DAY_MS
				: 0;
			if (!isStaff(current.role) && waitEnds > Date.now()) {
				return { ok: false, reason: 'username-too-soon' };
			}
			if (await isTakenByOthers(db, normalized, id)) return { ok: false, reason: 'username-taken' };
			patch.username = normalized;
		}
	}

	if (data.avatarKey !== undefined) {
		if (!AVATAR_KEYS.has(data.avatarKey)) return { ok: false, reason: 'avatar-invalid' };
		patch.avatarKey = data.avatarKey;
	}

	try {
		const now = new Date();
		const update = db
			.update(users)
			.set(renamed ? { ...patch, usernameChangedAt: now } : patch)
			.where(eq(users.id, id))
			.returning();
		if (!renamed || !current.username) {
			const [row] = await update;
			return { ok: true, user: row };
		}
		const retire = db
			.insert(retiredUsernames)
			.values({ username: current.username.toLowerCase(), userId: id, retiredAt: now })
			.onConflictDoUpdate({
				target: retiredUsernames.username,
				set: { userId: id, retiredAt: now }
			});
		const [[row]] = await db.batch([update, retire]);
		return { ok: true, user: row };
	} catch (e: unknown) {
		if (isUniqueViolation(e)) return { ok: false, reason: 'username-taken' };
		throw e;
	}
}

/** Whether a username can be chosen, or the first rule it breaks. */
export type UsernameAvailability = 'available' | 'taken' | 'reserved' | 'blocked' | 'format';

/**
 * Whether `username` could be chosen by the account `excludingId`: `updateProfile`'s own checks
 * of shape, reserved names, the blocklist and names held by other accounts (including
 * look-alikes and names they retired), in that order. The wait after a rename and a mute are
 * not part of it. Used for the debounced inline check on the profile edit form.
 */
export async function usernameAvailability(
	username: string,
	excludingId: string
): Promise<UsernameAvailability> {
	const normalized = username.toLowerCase();
	if (!NEW_USERNAME_RE.test(normalized)) return 'format';
	const refusal = usernameRefusal(normalized);
	if (refusal) return refusal;
	return (await isTakenByOthers(db, normalized, excludingId)) ? 'taken' : 'available';
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
			score: comments.score,
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
	/** When the report starts counting: the account is old enough from this date. */
	countsFrom: Date;
	/** Why none of the account's reports count: it is banned or muted. */
	restricted: 'banned' | 'muted' | null;
};

/** A reader's community reports, newest first, in every status, with the title joined. */
export async function getUserRatings(userId: string): Promise<UserRating[]> {
	const rows = await db
		.select({
			status: communityContentReports.status,
			titleId: communityContentReports.titleId,
			updatedAt: communityContentReports.updatedAt,
			accountCreatedAt: users.createdAt,
			role: users.role,
			bannedAt: users.bannedAt,
			mutedUntil: users.mutedUntil,
			...titleRef
		})
		.from(communityContentReports)
		.innerJoin(titles, eq(communityContentReports.titleId, titles.id))
		.innerJoin(users, eq(communityContentReports.userId, users.id))
		.where(eq(communityContentReports.userId, userId))
		.orderBy(desc(communityContentReports.updatedAt), desc(communityContentReports.titleId));
	return rows.map(({ accountCreatedAt, role, bannedAt, mutedUntil, ...row }) => ({
		...row,
		countsFrom: countsFromDate(accountCreatedAt, role),
		restricted: bannedAt !== null ? 'banned' : activeMute(mutedUntil) ? 'muted' : null
	}));
}
