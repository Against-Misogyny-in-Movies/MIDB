import { afterAll, beforeAll, beforeEach } from 'vitest';
import { getPlatformProxy } from 'wrangler';
import { getTableName, is, sql } from 'drizzle-orm';
import { SQLiteTable } from 'drizzle-orm/sqlite-core';
import * as schema from '#db/schema/index.ts';
import { bindDb, db } from '#lib/server/db.ts';
import { TEST_STATE_PATH } from './state.ts';

// Vitest setupFile for the `db` project: bind the app's `db` to the local D1 that globalSetup
// migrated, and start every test from empty app tables.

/** Children before parents, so every delete respects the foreign keys. */
const DELETE_ORDER = [
	'comments',
	'community_ddd_votes',
	'community_um_reports',
	'community_bechdel_ratings',
	'title_um',
	'title_bechdel',
	'um_source',
	'source_sync',
	'titles',
	'passkey',
	'account',
	'session',
	'verification',
	'user'
];

const schemaTables = Object.values(schema).flatMap((value) =>
	is(value, SQLiteTable) ? [getTableName(value)] : []
);
const missing = schemaTables.filter((name) => !DELETE_ORDER.includes(name));
if (missing.length > 0) {
	throw new Error(`db/test/setup.ts DELETE_ORDER lacks: ${missing.join(', ')}`);
}

let dispose: (() => Promise<void>) | undefined;

beforeAll(async () => {
	const proxy = await getPlatformProxy<{ DB: D1Database }>({
		// getPlatformProxy takes the state root itself; the wrangler CLI adds the `v3` folder.
		persist: { path: `${TEST_STATE_PATH}/v3` }
	});
	dispose = proxy.dispose;
	bindDb(proxy.env.DB);
});

beforeEach(async () => {
	for (const name of DELETE_ORDER) await db.run(sql.raw(`DELETE FROM "${name}"`));
});

afterAll(async () => {
	bindDb(undefined);
	await dispose?.();
});
