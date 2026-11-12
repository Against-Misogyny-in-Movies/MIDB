import { eq, sql } from 'drizzle-orm';
import type { Db } from '../../../client.ts';
import { sourceSync, type syncSource } from '../../../schema/sources.ts';

type SyncSource = (typeof syncSource)[number];

/** Records a successful sync of `source`, and how many rows it changed. */
export async function stampSync(
	db: Db,
	source: SyncSource,
	rowsChanged: number,
	now: Date
): Promise<void> {
	await db
		.insert(sourceSync)
		.values({ source, lastSuccessAt: now, rowsChanged })
		.onConflictDoUpdate({
			target: sourceSync.source,
			set: { lastSuccessAt: sql`excluded.last_success_at`, rowsChanged: sql`excluded.rows_changed` }
		});
}

/** When `source` last synced, or null if it never has. */
export async function lastSync(db: Db, source: SyncSource): Promise<Date | null> {
	const [row] = await db
		.select({ at: sourceSync.lastSuccessAt })
		.from(sourceSync)
		.where(eq(sourceSync.source, source));
	return row?.at ?? null;
}
