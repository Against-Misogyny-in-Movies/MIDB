import { sql } from 'drizzle-orm';
import { db } from '#lib/server/db.ts';

/**
 * Test-only write detection: triggers that log every insert, update and delete on the given
 * tables, so a spec can prove a read path wrote nothing (`writes()` unchanged). The log table
 * is outside the schema, so the reset leaves it alone; compare counts, never assume zero.
 */
export async function trackWrites(...tables: string[]): Promise<void> {
	await db.run(
		sql.raw(
			'CREATE TABLE IF NOT EXISTS _test_writes (id INTEGER PRIMARY KEY AUTOINCREMENT, source TEXT NOT NULL)'
		)
	);
	for (const table of tables) {
		for (const event of ['INSERT', 'UPDATE', 'DELETE']) {
			await db.run(
				sql.raw(
					`CREATE TRIGGER IF NOT EXISTS _tw_${table}_${event} AFTER ${event} ON "${table}" ` +
						`BEGIN INSERT INTO _test_writes (source) VALUES ('${table}'); END`
				)
			);
		}
	}
}

/** Writes logged so far, across every tracked table. */
export async function writes(): Promise<number> {
	const [row] = await db.all<{ n: number }>(sql`SELECT count(*) AS n FROM _test_writes`);
	return row.n;
}
