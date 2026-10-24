import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

/**
 * Build a Drizzle client over a postgres-js pool. The caller owns the URL (runtime env in the
 * app, process.env in scripts) and closes the pool with `sql.end()` when it is done.
 */
export function createDb(url: string, opts?: { max?: number }) {
	const sql = postgres(url, { connect_timeout: 10, max: opts?.max ?? 10 });
	return { db: drizzle(sql, { schema }), sql };
}

export type Db = ReturnType<typeof createDb>['db'];
