/**
 * How recently the session that asks to delete the account must have started, in minutes. An
 * older session is refused with `session-stale` and the reader signs in again first. The
 * settings page states it.
 */
export const DELETE_SESSION_MAX_AGE_MINUTES = 10;

/** Whether a session that started at `startedAt` is recent enough to delete the account. */
export function isRecentSession(startedAt: Date, now: number = Date.now()): boolean {
	return now - startedAt.getTime() <= DELETE_SESSION_MAX_AGE_MINUTES * 60_000;
}

/** Why `DELETE /api/me` refused to delete the account, for the settings page to put in words. */
export const ACCOUNT_DELETE_REFUSALS = [
	'username-mismatch',
	'session-stale',
	'last-administrator'
] as const;

export type AccountDeleteRefusal = (typeof ACCOUNT_DELETE_REFUSALS)[number];
