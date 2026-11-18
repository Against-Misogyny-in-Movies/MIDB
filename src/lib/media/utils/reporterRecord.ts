import type { ReporterRecord } from '#lib/media/types/moderation.ts';

/**
 * A reporter's record as one line: "Earlier reports: 3 of 4 upheld", counting the reports a
 * moderator has decided (upheld or dismissed; one still open on a live comment is neither).
 */
export function recordLine(record: Pick<ReporterRecord, 'upheld' | 'dismissed'>): string {
	const decided = record.upheld + record.dismissed;
	return decided === 0
		? 'Earlier reports: none decided yet'
		: `Earlier reports: ${record.upheld} of ${decided} upheld`;
}
