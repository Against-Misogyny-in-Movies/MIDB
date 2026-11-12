/** D1 allows 100 bound parameters in one statement. */
export const D1_MAX_PARAMS = 100;

/**
 * Splits `rows` into chunks that fit one D1 statement. `columns` is the number of bound
 * parameters each row adds (the column count of a bulk insert, 1 for an `inArray` value), and
 * `reserved` the parameters the rest of the statement binds (a `where kind = ?`).
 * @throws when a single row cannot fit.
 */
export function chunkForD1<T>(rows: readonly T[], columns: number, reserved = 0): T[][] {
	const perChunk = Math.floor((D1_MAX_PARAMS - reserved) / columns);
	if (!Number.isInteger(columns) || columns < 1 || perChunk < 1) {
		throw new Error(`A row of ${columns} parameters plus ${reserved} reserved exceeds D1's limit.`);
	}
	const chunks: T[][] = [];
	for (let i = 0; i < rows.length; i += perChunk) chunks.push(rows.slice(i, i + perChunk));
	return chunks;
}
