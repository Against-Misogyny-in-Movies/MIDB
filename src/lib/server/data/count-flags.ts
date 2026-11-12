import { and, eq, sql } from 'drizzle-orm';
import { db } from '#lib/server/db.ts';
import { titleCountFlags } from '#db/schema/community.ts';

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

/** Moves an open flag to `status`; false when it is not open (or does not exist). */
async function closeFlag(
	flagId: string,
	actorId: string,
	status: 'resolved' | 'dismissed'
): Promise<boolean> {
	const rows = await db
		.update(titleCountFlags)
		.set({ status, resolvedBy: actorId })
		.where(and(eq(titleCountFlags.id, flagId), eq(titleCountFlags.status, 'open')))
		.returning({ id: titleCountFlags.id });
	return rows.length > 0;
}

/** A moderator acted on the counts the flag pointed at. */
export const resolveCountFlag = (flagId: string, actorId: string) =>
	closeFlag(flagId, actorId, 'resolved');

/** A moderator found the counts fine. */
export const dismissCountFlag = (flagId: string, actorId: string) =>
	closeFlag(flagId, actorId, 'dismissed');
