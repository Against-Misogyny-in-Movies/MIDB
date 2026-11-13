import type { ReportAccount } from '#lib/media/types/moderation.ts';

const plural = (n: number, one: string) => `${n} ${n === 1 ? one : `${one}s`}`;

/** The account behind a report as one line: its name, age, report count and comment count. */
export function accountLine(account: ReportAccount, now = Date.now()): string {
	const days = Math.max(0, Math.floor((now - Date.parse(account.createdAt)) / 86_400_000));
	return `${account.username ?? 'An account'}, ${plural(days, 'day')} old, ${plural(account.reportCount, 'report')}, ${plural(account.commentCount, 'comment')}`;
}
