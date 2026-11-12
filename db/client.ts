import { drizzle, type DrizzleD1Database } from 'drizzle-orm/d1';
import type { BaseSQLiteDatabase } from 'drizzle-orm/sqlite-core';
import * as schema from './schema/index.ts';

/**
 * The Drizzle client type. Both the D1 client (the app, local scripts) and the sqlite-proxy
 * client (remote scripts) satisfy it, so queries are written once. Write them with the query
 * builder: a raw `db.all` / `db.get` with a `sql` template returns objects on D1 but positional
 * arrays over sqlite-proxy (`--remote`), so raw rows do not read the same on both.
 */
export type Db = BaseSQLiteDatabase<'async', unknown, typeof schema> &
	Pick<DrizzleD1Database<typeof schema>, 'batch'>;

/** Build a Drizzle client over a D1 binding (a Worker's `env.DB`, or a local one from wrangler). */
export function createDb(d1: D1Database): Db {
	return drizzle(d1, { schema });
}
