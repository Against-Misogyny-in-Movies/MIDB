/**
 * A SQLite UNIQUE violation. D1 reports it as "UNIQUE constraint failed: <table>.<column>", and
 * Drizzle wraps the driver error in a DrizzleQueryError, so the message is on `cause`.
 */
export function isUniqueViolation(e: unknown): boolean {
	if (typeof e !== 'object' || e === null) return false;
	const { cause, message } = e as { cause?: { message?: unknown }; message?: unknown };
	const text = cause?.message ?? message;
	return typeof text === 'string' && /UNIQUE constraint failed/.test(text);
}
