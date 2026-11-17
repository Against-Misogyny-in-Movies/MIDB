import { SCAN_CONCERN_MAX } from '#lib/media/utils/comments.ts';
import { listScanItems, saveScanLabels } from '#lib/server/data/comment-ai-labels.ts';
import type { UserRow } from '#lib/server/data/user-queries.ts';
import { text, type Outcome } from '#lib/server/http/moderation-action.ts';
import { pageIds } from './action-form.ts';
import { scanComments } from './scan.ts';

/**
 * Checks a page of comments against the moderator's concern: reads the comments, asks the model,
 * saves the labels, and counts the comments that matched, were checked and were not. Nothing is
 * saved when the model gave no answer.
 */
export async function runScan(staff: UserRow, data: FormData): Promise<Outcome> {
	const concern = text(data, 'concern');
	const ids = pageIds(data);
	if (!ids) return { ok: false, reason: 'invalid' };
	if (!concern || concern.length > SCAN_CONCERN_MAX) {
		return { ok: false, reason: 'invalid-concern' };
	}
	const items = await listScanItems(ids);
	const scan = await scanComments(concern, items);
	if (!scan.ok) return { ok: false, reason: scan.code };
	await saveScanLabels(staff.id, concern, scan.results);
	const matched = scan.results.filter((result) => result.match).length;
	return {
		ok: true,
		extra: {
			matched,
			checked: scan.results.length,
			notChecked: ids.length - scan.results.length
		}
	};
}
