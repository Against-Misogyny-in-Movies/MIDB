/** Postgres 23505. Drizzle wraps driver errors in DrizzleQueryError, so check `cause` too. */
export function isUniqueViolation(e: unknown): boolean {
	for (
		let err = e;
		typeof err === 'object' && err !== null;
		err = (err as { cause?: unknown }).cause
	) {
		if ((err as { code?: unknown }).code === '23505') return true;
	}
	return false;
}
