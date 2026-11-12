import { afterAll, beforeEach } from 'vitest';
import { getTableName, is, sql } from 'drizzle-orm';
import { PgTable } from 'drizzle-orm/pg-core';
import * as schema from '#db/schema/index.ts';
import { db, closeDb } from '#lib/server/db.ts';

// Vitest setupFile for the `db` project: every test starts from empty app tables.
const tables = Object.values(schema)
	.flatMap((value) => (is(value, PgTable) ? [`"${getTableName(value)}"`] : []))
	.join(', ');

beforeEach(async () => {
	await db.execute(sql.raw(`TRUNCATE ${tables} RESTART IDENTITY CASCADE`));
});

afterAll(async () => {
	await closeDb();
});
