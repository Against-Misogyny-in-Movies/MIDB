import type { BadgeTone } from '#lib/media/utils/tones.ts';
import { reportStatusTone } from '#lib/media/utils/tones.ts';
import type { ReportAccount, TitleReport } from '#lib/media/types/moderation.ts';
import { formatDate } from '#lib/media/utils/format.ts';

const plural = (n: number, one: string) => `${n} ${n === 1 ? one : `${one}s`}`;

/**
 * The account behind a report as one line: its name (unless `withName` is false, for a row
 * whose header names it already), age, reader reports not rejected and comments.
 */
export function accountLine(account: ReportAccount, withName = true, now = Date.now()): string {
	const days = Math.max(0, Math.floor((now - Date.parse(account.createdAt)) / 86_400_000));
	const facts = [
		`${plural(days, 'day')} old`,
		`${plural(account.reportCount, 'reader report')} not rejected`,
		plural(account.commentCount, 'comment')
	].join(', ');
	return withName ? `${account.username ?? 'An account'}, ${facts}` : facts;
}

/**
 * A report's status as a moderator reads it, with whether it is in the counts now: a counted
 * report of a banned or muted account, or of one younger than the minimum age, is not.
 */
export function reportStanding(
	status: TitleReport['status'],
	account: ReportAccount,
	now = Date.now()
): { label: string; tone: BadgeTone } {
	if (status === 'held') return { label: 'Held', tone: reportStatusTone(status) };
	if (status === 'rejected') return { label: 'Rejected', tone: reportStatusTone(status) };
	if (account.restricted) {
		return { label: `Not counted: account ${account.restricted}`, tone: 'neutral' };
	}
	if (Date.parse(account.countsFrom) > now) {
		return { label: `Counts from ${formatDate(account.countsFrom)}`, tone: 'neutral' };
	}
	return { label: 'Counted', tone: reportStatusTone(status) };
}
