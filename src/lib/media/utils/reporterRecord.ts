import type { ReporterRecord } from '#lib/media/types/moderation.ts';

/** A reporter's record as the line beside their name: "4 upheld, 1 dismissed". */
export const recordLine = (record: Pick<ReporterRecord, 'upheld' | 'dismissed'>): string =>
	`${record.upheld} upheld, ${record.dismissed} dismissed`;
