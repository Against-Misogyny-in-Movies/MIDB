import { inArray, or, sql, type SQL } from 'drizzle-orm';
import { users } from '#db/schema/auth.ts';
import { REPORT_ACCOUNT_MIN_AGE_DAYS } from '#lib/media/utils/communityReports.ts';
import { isStaff, STAFF_ROLES } from '#lib/media/utils/staff.ts';

const DAY_MS = 86_400_000;

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
	return (
		isStaff(user.role) || user.createdAt.getTime() <= now - REPORT_ACCOUNT_MIN_AGE_DAYS * DAY_MS
	);
}
