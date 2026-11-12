import { db } from '#lib/server/db.ts';
import { getCached } from '#lib/server/cache/index.ts';
import { sourceSync } from '#db/schema/sources.ts';
import type { SourceSyncDates } from '#lib/media/types/source-sync.ts';

/**
 * Kept for five minutes: well under the title pages' edge TTL (`#lib/server/http/cache.ts`), so
 * the label never trails the sync by more than the page itself does.
 */
const SOURCE_SYNC_TTL_MS = 5 * 60 * 1000;

/**
 * When the daily sync last succeeded for each source that has a `source_sync` row, as ISO
 * strings (the cache stores JSON). A source with no row is absent, so a fresh database shows no
 * label.
 */
export function getSourceSyncDates(): Promise<SourceSyncDates> {
	return getCached('source-sync:dates', SOURCE_SYNC_TTL_MS, async () => {
		const rows = await db
			.select({ source: sourceSync.source, at: sourceSync.lastSuccessAt })
			.from(sourceSync);
		const dates: SourceSyncDates = {};
		for (const row of rows) dates[row.source] = row.at.toISOString();
		return dates;
	});
}
