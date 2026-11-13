import { and, eq, sql } from 'drizzle-orm';
import { db } from '#lib/server/db.ts';
import { moderationActions, titleCountFlags } from '#db/schema/community.ts';
import { canCloseFlag } from '#lib/media/utils/canActOn.ts';
import { runBatch } from './comment-status.ts';
import type { UserRow } from './user-queries.ts';

/** How a close ends: `own-flag` when a moderator closes their own flag. */
export type FlagCloseResult =
	| { ok: true }
	| { ok: false; reason: 'not-found' | 'invalid-state' | 'own-flag' };

/** The "counts look wrong" flags on a title, by status. */
export async function flagCounts(
	titleId: string
): Promise<{ open: number; resolved: number; dismissed: number }> {
	const rows = await db
		.select({ status: titleCountFlags.status, n: sql<number>`count(*)` })
		.from(titleCountFlags)
		.where(eq(titleCountFlags.titleId, titleId))
		.groupBy(titleCountFlags.status);
	const out = { open: 0, resolved: 0, dismissed: 0 };
	for (const r of rows) out[r.status] = r.n;
	return out;
}

/**
 * Moves an open flag to `status` and logs it in the same batch, the log row only while the flag
 * is still open. `canCloseFlag` decides who may: a moderator cannot close their own flag, and
 * gets `own-flag`. `invalid-state` when the flag is not open, `not-found` when it does not
 * exist. Counts do not change, so nothing is purged.
 */
async function closeFlag(
	flagId: string,
	actor: UserRow,
	status: 'resolved' | 'dismissed'
): Promise<FlagCloseResult> {
	const actorId = actor.id;
	const [flag] = await db
		.select({ reporterId: titleCountFlags.reporterId })
		.from(titleCountFlags)
		.where(eq(titleCountFlags.id, flagId));
	if (!flag) return { ok: false, reason: 'not-found' };
	if (!canCloseFlag(actor, flag.reporterId)) return { ok: false, reason: 'own-flag' };
	const action = status === 'resolved' ? 'resolve_count_flag' : 'dismiss_count_flag';
	const open = and(eq(titleCountFlags.id, flagId), eq(titleCountFlags.status, 'open'));
	const results = await runBatch([
		db.insert(moderationActions).select(
			db
				.select({
					id: sql<string>`${crypto.randomUUID()}`.as('id'),
					actorId: sql<string>`${actorId}`.as('actorId'),
					targetCommentId: sql<string | null>`NULL`.as('targetCommentId'),
					targetUserId: sql<string | null>`NULL`.as('targetUserId'),
					targetTitleId: titleCountFlags.titleId,
					action: sql<typeof action>`${action}`.as('action'),
					reason: sql<string | null>`NULL`.as('reason'),
					muteHours: sql<number | null>`NULL`.as('muteHours'),
					createdAt: sql<number>`${Date.now()}`.as('createdAt')
				})
				.from(titleCountFlags)
				.where(open)
		),
		db
			.update(titleCountFlags)
			.set({ status, resolvedBy: actorId })
			.where(open)
			.returning({ id: titleCountFlags.id })
	]);
	const closed = results[1];
	return Array.isArray(closed) && closed.length > 0
		? { ok: true }
		: { ok: false, reason: 'invalid-state' };
}

/** A moderator acted on the counts the flag pointed at. */
export const resolveCountFlag = (flagId: string, actor: UserRow) =>
	closeFlag(flagId, actor, 'resolved');

/** A moderator found the counts fine. */
export const dismissCountFlag = (flagId: string, actor: UserRow) =>
	closeFlag(flagId, actor, 'dismissed');

/**
 * Stores a reader's "counts look wrong" flag on a title: one per account per title. A second
 * call replaces the note and re-opens a flag a moderator had closed, so the reader can raise it
 * again.
 */
export async function upsertCountFlag(
	titleId: string,
	reporterId: string,
	note: string | null
): Promise<void> {
	await db
		.insert(titleCountFlags)
		.values({ titleId, reporterId, note })
		.onConflictDoUpdate({
			target: [titleCountFlags.titleId, titleCountFlags.reporterId],
			set: { note, status: 'open', resolvedBy: null, updatedAt: new Date() }
		});
}
