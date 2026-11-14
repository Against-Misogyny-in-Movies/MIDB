import { inArray, or, sql, type SQL } from 'drizzle-orm';
import { users } from '#db/schema/auth.ts';
import { REPORT_ACCOUNT_MIN_AGE_DAYS } from '#lib/media/utils/communityReports.ts';
import { isStaff, STAFF_ROLES } from '#lib/media/utils/staff.ts';
import { DAY_MS } from '#lib/media/utils/time.ts';

/** When a report or vote from an account created at `createdAt` starts counting: at once for staff. */
export function countsFromDate(createdAt: Date, role: string): Date {
	return isStaff(role)
		? createdAt
		: new Date(createdAt.getTime() + REPORT_ACCOUNT_MIN_AGE_DAYS * DAY_MS);
}

/**
 * The rule for an account whose reports and votes carry weight, over `users`: staff, or at
 * least `REPORT_ACCOUNT_MIN_AGE_DAYS` old, and neither banned nor muted. Title counts, public
 * profiles, a comment's report threshold and the burst hold all read it.
 */
export function countingAccountWhere(now: number = Date.now()): SQL {
	return sql`(${or(
		inArray(users.role, [...STAFF_ROLES]),
		sql`${users.createdAt} <= ${now - REPORT_ACCOUNT_MIN_AGE_DAYS * DAY_MS}`
	)} AND ${users.bannedAt} IS NULL AND (${users.mutedUntil} IS NULL OR ${users.mutedUntil} <= ${now}))`;
}

/** Whether an account may vote: staff, or at least `REPORT_ACCOUNT_MIN_AGE_DAYS` old. */
export function accountOldEnough(
	user: { role: string; createdAt: Date },
	now: number = Date.now()
): boolean {
	return countsFromDate(user.createdAt, user.role).getTime() <= now;
}

/** When a vote from the account starts counting, while that is in the future; otherwise null. */
export function votesOpenAt(
	user: { role: string; createdAt: Date },
	now: number = Date.now()
): string | null {
	const from = countsFromDate(user.createdAt, user.role);
	return from.getTime() > now ? from.toISOString() : null;
}
