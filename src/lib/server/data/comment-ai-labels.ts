import { db } from '#lib/server/db.ts';
import { commentAiLabels } from '#db/schema/community.ts';
import { chunkForD1 } from '#db/lib/chunkForD1.ts';
import type { ScanResult } from '#lib/server/moderation/scan.ts';
import type { BatchStatement } from './comment-status.ts';

/** Columns an insert binds, for `chunkForD1`: the ten values and the id and timestamps' defaults. */
const COLUMNS = 11;

/**
 * Saves what an AI scan found. Every result is a new row, so the newest row per comment is
 * its label and earlier scans stay. All rows are written in one `db.batch`, so a scan is saved
 * whole or not at all. `concern` is the moderator's text, at most `SCAN_CONCERN_MAX`.
 */
export async function saveScanLabels(
	staffId: string,
	concern: string,
	results: ScanResult[]
): Promise<void> {
	const rows = results.map((result) => ({
		commentId: result.id,
		concern,
		matched: result.match,
		categories: JSON.stringify(result.categories),
		severity: result.severity,
		reason: result.reason,
		model: result.model,
		scannedBy: staffId
	}));
	const statements: BatchStatement[] = chunkForD1(rows, COLUMNS).map((chunk) =>
		db.insert(commentAiLabels).values(chunk)
	);
	if (statements.length === 0) return;
	await db.batch(statements as [BatchStatement, ...BatchStatement[]]);
}
