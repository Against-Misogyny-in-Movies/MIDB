import { and, asc, eq, inArray, isNull, ne, sql } from 'drizzle-orm';
import { chunkForD1 } from '#db/lib/chunkForD1.ts';
import { db } from '#lib/server/db.ts';
import { users } from '#db/schema/auth.ts';
import { moderationActions } from '#db/schema/community.ts';
import type { PublicUser } from '#lib/media/types/user.ts';
import { STAFF_ROLES } from '#lib/media/utils/staff.ts';
import { runBatch } from './comment-status.ts';
import { logRow } from './moderation-log.ts';
import { toPublicUser, type UserRow } from './user-queries.ts';

/** One administrator or moderator on the staff page. */
export type StaffMember = {
	user: PublicUser;
	/** When the account took its role (ISO): the latest `set_role` row that made it a moderator, else the day it joined. */
	since: string;
};

/** Administrators first, then moderators, each by username. */
export async function listStaff(): Promise<StaffMember[]> {
	const rows = await db
		.select()
		.from(users)
		.where(and(inArray(users.role, [...STAFF_ROLES]), isNull(users.deletedAt)))
		.orderBy(asc(users.role), asc(sql`lower(${users.username})`));
	const promoted = new Map<string, Date>();
	for (const chunk of chunkForD1(
		rows.map((r) => r.id),
		1,
		2
	)) {
		for (const row of await db
			.select({
				userId: moderationActions.targetUserId,
				at: sql<number>`max(${moderationActions.createdAt})`
			})
			.from(moderationActions)
			.where(
				and(
					eq(moderationActions.action, 'set_role'),
					eq(moderationActions.reason, 'moderator'),
					inArray(moderationActions.targetUserId, chunk)
				)
			)
			.groupBy(moderationActions.targetUserId)) {
			if (row.userId) promoted.set(row.userId, new Date(row.at));
		}
	}
	return rows.map((row) => ({
		user: toPublicUser(row),
		since: (row.role === 'moderator'
			? (promoted.get(row.id) ?? row.createdAt)
			: row.createdAt
		).toISOString()
	}));
}

export type RoleResult =
	| { ok: true; title: null; purge: { profiles: string[] } }
	| {
			ok: false;
			/**
			 * `not-administrator`: only an administrator changes roles. `unknown-account`: no live
			 * account has that username. `not-found`: the account is gone. `account-banned`: a banned
			 * account is not made a moderator. `already-role`: it already has the role (or lost it between
			 * the read and the write). `is-administrator`: the page never demotes an administrator.
			 * `last-administrator`: that administrator is the only one left.
			 */
			reason:
				| 'not-administrator'
				| 'unknown-account'
				| 'not-found'
				| 'account-banned'
				| 'already-role'
				| 'is-administrator'
				| 'last-administrator';
	  };

/** Whether another administrator can still act: not deleted and not banned. */
const otherAdministrator = (userId: string) =>
	sql`EXISTS (SELECT 1 FROM "user" o WHERE o.role = 'administrator' AND o.deleted_at IS NULL AND o.banned_at IS NULL AND o.id != ${userId})`;

/**
 * Sets an account's role to `moderator` or back to `user` and logs it as `set_role`, in one
 * batch whose log row and update carry the same guard, so a lost race writes neither. The log
 * row's reason is the new role. Only an administrator changes roles, and never to administrator
 * (the seed script is the one way). Refused: an account that is gone, a banned one on its way
 * to moderator, one that already has the role, and an administrator (`last-administrator` when
 * no other can act, else `is-administrator`). The purge is the account's profile, which shows
 * the staff badge.
 */
export async function setStaffRole(
	actor: UserRow,
	target: { id: string } | { username: string },
	role: 'moderator' | 'user'
): Promise<RoleResult> {
	if (actor.role !== 'administrator') return { ok: false, reason: 'not-administrator' };
	const [row] = await db
		.select()
		.from(users)
		.where(
			'id' in target
				? eq(users.id, target.id)
				: eq(sql`lower(${users.username})`, target.username.toLowerCase())
		);
	if (!row || row.deletedAt) {
		return { ok: false, reason: 'username' in target ? 'unknown-account' : 'not-found' };
	}
	if (row.role === 'administrator') {
		const [others] = await db
			.select({ n: sql<number>`(SELECT ${otherAdministrator(row.id)})` })
			.from(sql`(SELECT 1) AS one`);
		return { ok: false, reason: others.n ? 'is-administrator' : 'last-administrator' };
	}
	if (row.role === role) return { ok: false, reason: 'already-role' };
	if (role === 'moderator' && row.bannedAt) return { ok: false, reason: 'account-banned' };
	const applies = and(
		eq(users.id, row.id),
		eq(users.role, row.role),
		ne(users.role, 'administrator'),
		isNull(users.deletedAt),
		role === 'moderator' ? isNull(users.bannedAt) : undefined,
		sql`EXISTS (SELECT 1 FROM "user" a WHERE a.id = ${actor.id} AND a.role = 'administrator')`
	);
	const results = await runBatch([
		db.insert(moderationActions).select(
			db
				.select(logRow(actor.id, 'set_role', { userId: users.id, reason: role }))
				.from(users)
				.where(applies)
		),
		db.update(users).set({ role }).where(applies).returning({ id: users.id })
	]);
	const changed = results[1];
	return Array.isArray(changed) && changed.length > 0
		? { ok: true, title: null, purge: { profiles: [row.id] } }
		: { ok: false, reason: 'already-role' };
}
