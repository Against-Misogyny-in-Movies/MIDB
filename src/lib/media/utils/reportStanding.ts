import type { ContentReportStatus } from '#lib/media/utils/readerReports.ts';
import { reportStatusTone, type BadgeTone } from '#lib/media/utils/tones.ts';
import { formatDate } from '#lib/media/utils/format.ts';

/** Why a counted report is not in the counts: its account is muted or banned. */
export type Restriction = 'muted' | 'banned';

/** Whether a report is in the counts now, and if not, why. */
export type Standing =
	| { kind: 'counted' }
	| { kind: 'held' }
	| { kind: 'rejected' }
	| { kind: 'restricted'; by: Restriction }
	| { kind: 'young'; countsFrom: string };

export type StandingLabel = { label: string; tone: BadgeTone };

/**
 * The one decision on a report's standing: a held or rejected report is as its status says; a
 * counted one may still be out of the counts because its account is muted or banned, or younger
 * than the minimum age. The reader's and the moderator's labels both map from this.
 */
export function effectiveStanding(
	report: {
		status: ContentReportStatus;
		countsFrom: Date | string;
		restricted?: Restriction | null;
	},
	now = Date.now()
): Standing {
	if (report.status === 'held') return { kind: 'held' };
	if (report.status === 'rejected') return { kind: 'rejected' };
	if (report.restricted) return { kind: 'restricted', by: report.restricted };
	const from = new Date(report.countsFrom);
	if (from.getTime() > now) return { kind: 'young', countsFrom: from.toISOString() };
	return { kind: 'counted' };
}

function shared(standing: Standing): StandingLabel | null {
	switch (standing.kind) {
		case 'restricted':
			return { label: `Not counted: account ${standing.by}`, tone: 'neutral' };
		case 'young':
			return { label: `Counts from ${formatDate(standing.countsFrom)}`, tone: 'neutral' };
		case 'counted':
			return { label: 'Counted', tone: reportStatusTone('counted') };
		default:
			return null;
	}
}

/** The standing as its author reads it, on the title page and `/user/metrics`. */
export function readerStandingLabel(standing: Standing): StandingLabel {
	if (standing.kind === 'held')
		return { label: 'Waiting for review', tone: reportStatusTone('held') };
	if (standing.kind === 'rejected')
		return { label: 'Not counted', tone: reportStatusTone('rejected') };
	return shared(standing)!;
}

/** The standing as a moderator reads it in the queue. */
export function moderatorStandingLabel(standing: Standing): StandingLabel {
	if (standing.kind === 'held') return { label: 'Held', tone: reportStatusTone('held') };
	if (standing.kind === 'rejected')
		return { label: 'Rejected', tone: reportStatusTone('rejected') };
	return shared(standing)!;
}
