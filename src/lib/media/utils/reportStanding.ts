import { STATUS_LABELS, type ContentReportStatus } from '#lib/media/utils/readerReports.ts';
import { reportStatusTone, type BadgeTone } from '#lib/media/utils/tones.ts';
import { formatDate } from '#lib/media/utils/format.ts';

/**
 * What a report's standing reads as to its author: a counted report may not count yet (its
 * account is young) or at all (the account is muted or banned). One source for the title page
 * and `/user/metrics`.
 */
export function reportStanding(
	report: { status: ContentReportStatus; countsFrom: Date | string },
	options: { restricted?: boolean; now?: number } = {}
): { label: string; tone: BadgeTone } {
	const { restricted = false, now = Date.now() } = options;
	if (report.status !== 'counted')
		return { label: STATUS_LABELS[report.status], tone: reportStatusTone(report.status) };
	if (restricted) return { label: STATUS_LABELS.rejected, tone: reportStatusTone('rejected') };
	const from = new Date(report.countsFrom);
	if (from.getTime() > now)
		return { label: `Counts from ${formatDate(from.toISOString())}`, tone: 'neutral' };
	return { label: STATUS_LABELS.counted, tone: reportStatusTone('counted') };
}
