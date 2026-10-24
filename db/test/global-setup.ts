import postgres from 'postgres';
import { loadEnv } from 'vite';
import { migrateDatabase } from '../scripts/migrate';

/**
 * Vitest globalSetup for the `db` project: wipe TEST_DB_CONNECTION and migrate it from zero,
 * so every run also proves the migration chain applies to an empty database.
 */
export default async function setup() {
	const env = loadEnv('test', process.cwd(), '');
	const url = env.TEST_DB_CONNECTION;
	if (!url) throw new Error('TEST_DB_CONNECTION is not set: the db tests need their own database.');
	if (url === env.DB_CONNECTION) {
		throw new Error('TEST_DB_CONNECTION must not equal DB_CONNECTION: the db tests wipe it.');
	}

	const sql = postgres(url, { max: 1, connect_timeout: 10, onnotice: () => {} });
	try {
		await sql`DROP SCHEMA IF EXISTS drizzle CASCADE`;
		await sql`DROP SCHEMA IF EXISTS public CASCADE`;
		await sql`CREATE SCHEMA public`;
	} finally {
		await sql.end();
	}

	await migrateDatabase(url);
}
