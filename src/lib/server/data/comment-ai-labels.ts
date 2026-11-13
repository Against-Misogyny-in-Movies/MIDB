import { and, eq, inArray, ne } from 'drizzle-orm';
import { db } from '#lib/server/db.ts';
import { commentAiLabels, comments } from '#db/schema/community.ts';
import { titles } from '#db/schema/titles.ts';
import { chunkForD1 } from '#db/lib/chunkForD1.ts';
import { SCAN_CONCERN_MAX } from '#lib/media/utils/comments.ts';
import type { ScanItem, ScanResult } from '#lib/server/moderation/scan.ts';
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

/**
 * The comments a scan sends, in the order of `ids`: each one found that is not deleted, with its
 * body, its title's name and the title's kind. An id that is unknown or deleted is left out.
 */
export async function listScanItems(ids: string[]): Promise<ScanItem[]> {
	const found = new Map<string, ScanItem>();
	for (const chunk of chunkForD1(ids, 1, 1)) {
		const rows = await db
			.select({
				id: comments.id,
				body: comments.body,
				titleName: titles.title,
				kind: titles.kind
			})
			.from(comments)
			.innerJoin(titles, eq(comments.titleId, titles.id))
			.where(and(inArray(comments.id, chunk), ne(comments.status, 'deleted')));
		for (const row of rows) found.set(row.id, row);
	}
	return ids.flatMap((id) => {
		const item = found.get(id);
		return item ? [item] : [];
	});
}
