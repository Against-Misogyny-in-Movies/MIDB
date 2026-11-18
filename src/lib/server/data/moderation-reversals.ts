import { and, eq, gt, isNotNull } from 'drizzle-orm';
import { db } from '#lib/server/db.ts';
import { users } from '#db/schema/auth.ts';
import { logWhere, runLogged } from './moderation-log.ts';
import type { ModerationResult } from './moderation-actions.ts';
import { latestActionRows, muteSetByModerator, targetAllowed } from './moderation-target.ts';
import { activeMute } from './mute.ts';
import type { UserRow } from './user-queries.ts';

/**
 * What a mute or a ban change put back: the account's profile, and the counts of every title it
 * reported, which count its reports again.
 */
const restoredPurge = (userId: string) => ({ profiles: [userId], reportedBy: userId });

/**
 * Ends an account's mute and logs it, in one batch. An administrator may end any mute; a
 * moderator only one whose latest `mute` row a moderator wrote (`muteSetByModerator`), else
 * `admin-acted`. The batch carries the same conditions, so a mute that ended or was replaced
 * between the read and the batch changes nothing: the reason is read again, `not-muted` when the
 * mute ended and `admin-acted` only when an administrator's mute is in force now. The purge is
 * the mute's: the profile and the counts of the titles the account reported.
 */
export async function unmuteUser(
	actor: UserRow,
	targetId: string,
	reason: string | null
): Promise<ModerationResult> {
	const target = await targetAllowed(actor, targetId, 'reverse');
	if (typeof target === 'string') return { ok: false, reason: target };
	if (!activeMute(target.mutedUntil)) return { ok: false, reason: 'not-muted' };
	const bound = actor.role !== 'administrator';
	const mayEnd = and(
		eq(users.id, targetId),
		gt(users.mutedUntil, new Date()),
		bound ? muteSetByModerator(targetId) : undefined
	);
	const applied = await runLogged(
		logWhere(actor.id, 'unmute', { userId: users.id, reason }, users, mayEnd),
		db.update(users).set({ mutedUntil: null }).where(mayEnd).returning({ id: users.id })
	);
	if (applied) return { ok: true, title: null, purge: restoredPurge(targetId) };
	const [now] = await db
		.select({ mutedUntil: users.mutedUntil })
		.from(users)
		.where(eq(users.id, targetId));
	if (!now || !activeMute(now.mutedUntil)) return { ok: false, reason: 'not-muted' };
	const latest = (await latestActionRows('mute', [targetId])).get(targetId);
	return { ok: false, reason: latest?.actorRole === 'administrator' ? 'admin-acted' : 'not-muted' };
}

/**
 * Lifts an account's ban and logs it, in one batch; only an administrator may (`admin-only`
 * otherwise). It clears `banned_at` and `ban_reason` and restores sign-in; the comments the ban
 * hid stay hidden and its removed votes stay removed (`banWeightStatements`), so the purge is
 * the profile and the counts of the titles the account reported.
 */
export async function unbanAccount(
	actor: UserRow,
	targetId: string,
	reason: string | null
): Promise<ModerationResult> {
	if (actor.role !== 'administrator') return { ok: false, reason: 'admin-only' };
	const target = await targetAllowed(actor, targetId, 'reverse');
	if (typeof target === 'string') return { ok: false, reason: target };
	if (!target.bannedAt) return { ok: false, reason: 'not-banned' };
	const banned = and(eq(users.id, targetId), isNotNull(users.bannedAt));
	const applied = await runLogged(
		logWhere(actor.id, 'unban', { userId: users.id, reason }, users, banned),
		db
			.update(users)
			.set({ bannedAt: null, banReason: null })
			.where(banned)
			.returning({ id: users.id })
	);
	return applied
		? { ok: true, title: null, purge: restoredPurge(targetId) }
		: { ok: false, reason: 'not-banned' };
}
