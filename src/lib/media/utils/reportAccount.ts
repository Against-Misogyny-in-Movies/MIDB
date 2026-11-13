import type { ReportAccount } from '#lib/media/types/moderation.ts';

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
