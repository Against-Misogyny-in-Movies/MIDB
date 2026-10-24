import { afterAll, beforeEach } from 'vitest';
import { getTableName, is, sql } from 'drizzle-orm';
import { PgTable } from 'drizzle-orm/pg-core';
import * as schema from '$db/schema';
import { db, closeDb } from '$lib/server/db';

// Vitest setupFile for the `db` project: every test starts from empty app tables.
const tables = Object.values(schema)
	.filter((value): value is PgTable => is(value, PgTable))
	.map((table) => `"${getTableName(table)}"`)
	.join(', ');

beforeEach(async () => {
	await db.execute(sql.raw(`TRUNCATE ${tables} RESTART IDENTITY CASCADE`));
});

afterAll(async () => {
	await closeDb();
});
