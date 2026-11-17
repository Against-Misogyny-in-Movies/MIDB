/**
 * How recently the session that asks to delete the account must have started, in minutes. An
 * older session is refused with `session-stale` and the reader signs in again first. The
 * settings page states it.
 */
export const DELETE_SESSION_MAX_AGE_MINUTES = 10;

/** Why `DELETE /api/me` refused to delete the account, for the settings page to put in words. */
export const ACCOUNT_DELETE_REFUSALS = [
	'username-mismatch',
	'session-stale',
	'last-administrator'
] as const;

export type AccountDeleteRefusal = (typeof ACCOUNT_DELETE_REFUSALS)[number];
