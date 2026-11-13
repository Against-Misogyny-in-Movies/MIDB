import { and, eq, sql } from 'drizzle-orm';
import { db } from '#lib/server/db.ts';
import { moderationActions, titleCountFlags } from '#db/schema/community.ts';
import { runBatch } from './comment-status.ts';

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
 * is still open; false when it is not open (or does not exist). Counts do not change, so
 * nothing is purged.
 */
async function closeFlag(
	flagId: string,
	actorId: string,
	status: 'resolved' | 'dismissed'
): Promise<boolean> {
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
	return Array.isArray(closed) && closed.length > 0;
}

/** A moderator acted on the counts the flag pointed at. */
export const resolveCountFlag = (flagId: string, actorId: string) =>
	closeFlag(flagId, actorId, 'resolved');

/** A moderator found the counts fine. */
export const dismissCountFlag = (flagId: string, actorId: string) =>
	closeFlag(flagId, actorId, 'dismissed');

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
