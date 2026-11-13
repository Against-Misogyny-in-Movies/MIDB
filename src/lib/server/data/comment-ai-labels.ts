import { db } from '#lib/server/db.ts';
import { commentAiLabels } from '#db/schema/community.ts';
import { chunkForD1 } from '#db/lib/chunkForD1.ts';
import { SCAN_CONCERN_MAX } from '#lib/media/utils/comments.ts';
import type { ScanResult } from '#lib/server/moderation/scan.ts';
import { runBatch } from './comment-status.ts';

/** Values an insert binds per row, for `chunkForD1`: the eight written here, and the id and both timestamps from their defaults. */
const COLUMNS = 11;

/**
 * Saves what an AI scan found. Every result is a new row, so the newest row per comment is
 * its label and earlier scans stay. All rows are written in one `db.batch`, so a scan is saved
 * whole or not at all. `concern` is the moderator's text: trimmed, then 1 to `SCAN_CONCERN_MAX`
 * characters, or this throws before anything is written.
 */
export async function saveScanLabels(
	staffId: string,
	concern: string,
	results: ScanResult[]
): Promise<void> {
	const text = concern.trim();
	if (text === '' || text.length > SCAN_CONCERN_MAX) throw new Error('Invalid scan concern');
	const rows = results.map((result) => ({
		commentId: result.id,
		concern: text,
		matched: result.match,
		categories: JSON.stringify(result.categories),
		severity: result.severity,
		reason: result.reason,
		model: result.model,
		scannedBy: staffId
	}));
	await runBatch(
		chunkForD1(rows, COLUMNS).map((chunk) => db.insert(commentAiLabels).values(chunk))
	);
}
