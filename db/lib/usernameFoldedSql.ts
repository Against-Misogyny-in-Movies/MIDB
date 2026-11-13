import { sql, type SQL } from 'drizzle-orm';
import type { AnySQLiteColumn } from 'drizzle-orm/sqlite-core';
import { USERNAME_FOLD } from './usernameFold.ts';

/**
 * The SQL form of `foldUsername` over a column, the expression of the `username_folded`
 * generated columns (`db/schema/auth.ts`). SQLite computes it, so the old Worker's writes
 * keep it correct.
 */
export function foldedUsernameSql(column: AnySQLiteColumn): SQL {
	return USERNAME_FOLD.reduce<SQL>(
		(expr, [from, to]) => sql`replace(${expr}, ${sql.raw(`'${from}'`)}, ${sql.raw(`'${to}'`)})`,
		sql`lower(${column})`
	);
}
