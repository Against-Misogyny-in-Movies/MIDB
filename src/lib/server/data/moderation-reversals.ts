import { and, eq, gt, isNotNull } from 'drizzle-orm';
import { db } from '#lib/server/db.ts';
import { users } from '#db/schema/auth.ts';
import { moderationActions } from '#db/schema/community.ts';
import { canActOn } from '#lib/media/utils/canActOn.ts';
import { runBatch } from './comment-status.ts';
import { logRow } from './moderation-log.ts';
import type { ModerationResult } from './moderation-actions.ts';
import { muteSetByModerator } from './moderation-target.ts';
import { activeMute } from './mute.ts';
import type { UserRow } from './user-queries.ts';

/**
 * What a mute or a ban change put back: the account's profile, and the counts of every title it
 * reported, which count its reports again.
 */
const restoredPurge = (userId: string) => ({ profiles: [userId], reportedBy: userId });

/** The account a reversal acts on, or why it cannot: gone, or not one the actor may restrict. */
async function reversalTarget(
	actor: UserRow,
	targetId: string
): Promise<UserRow | 'not-found' | 'forbidden-target'> {
	const [target] = await db.select().from(users).where(eq(users.id, targetId));
	if (!target || target.deletedAt) return 'not-found';
	return canActOn(actor, target, 'restrict') ? target : 'forbidden-target';
}

/**
 * Ends an account's mute and logs it, in one batch. An administrator may end any mute; a
 * moderator only one whose latest `mute` row a moderator wrote (`muteSetByModerator`), else
 * `admin-acted`. The batch carries the same conditions, so a mute that ended or was replaced
 * between the read and the batch changes nothing (`not-muted`, or `admin-acted`). The purge is
 * the mute's: the profile and the counts of the titles the account reported.
 */
export async function unmuteUser(
	actor: UserRow,
	targetId: string,
	reason: string | null
): Promise<ModerationResult> {
	const target = await reversalTarget(actor, targetId);
	if (typeof target === 'string') return { ok: false, reason: target };
	if (!activeMute(target.mutedUntil)) return { ok: false, reason: 'not-muted' };
	const bound = actor.role !== 'administrator';
	const mayEnd = and(
		eq(users.id, targetId),
		gt(users.mutedUntil, new Date()),
		bound ? muteSetByModerator(targetId) : undefined
	);
	const results = await runBatch([
		db.insert(moderationActions).select(
			db
				.select(logRow(actor.id, 'unmute', { userId: users.id, reason }))
				.from(users)
				.where(mayEnd)
		),
		db.update(users).set({ mutedUntil: null }).where(mayEnd).returning({ id: users.id })
	]);
	const ended = results[1];
	if (Array.isArray(ended) && ended.length > 0) {
		return { ok: true, title: null, purge: restoredPurge(targetId) };
	}
	return { ok: false, reason: bound ? 'admin-acted' : 'not-muted' };
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
	const target = await reversalTarget(actor, targetId);
	if (typeof target === 'string') return { ok: false, reason: target };
	if (!target.bannedAt) return { ok: false, reason: 'not-banned' };
	const banned = and(eq(users.id, targetId), isNotNull(users.bannedAt));
	const results = await runBatch([
		db.insert(moderationActions).select(
			db
				.select(logRow(actor.id, 'unban', { userId: users.id, reason }))
				.from(users)
				.where(banned)
		),
		db
			.update(users)
			.set({ bannedAt: null, banReason: null })
			.where(banned)
			.returning({ id: users.id })
	]);
	const lifted = results[1];
	return Array.isArray(lifted) && lifted.length > 0
		? { ok: true, title: null, purge: restoredPurge(targetId) }
		: { ok: false, reason: 'not-banned' };
}
