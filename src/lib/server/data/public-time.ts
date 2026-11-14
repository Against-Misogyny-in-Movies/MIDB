const MINUTE_MS = 60_000;

/**
 * A time as it appears in public output: rounded down to the minute, so a comment's exact time
 * does not link an account's activity to another log. The author's own and staff views carry
 * the exact time (`toOwnComment`, the moderation queue).
 */
export function publicTime(date: Date): string {
	return new Date(Math.floor(date.getTime() / MINUTE_MS) * MINUTE_MS).toISOString();
}
