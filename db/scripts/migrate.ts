import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { createDb } from '../client';

const migrationsFolder = new URL('../migrations', import.meta.url).pathname;

/** Apply every pending migration in db/migrations to `url` over a single connection. */
export async function migrateDatabase(url: string): Promise<void> {
	const { db, sql } = createDb(url, { max: 1 });
	try {
		await migrate(db, { migrationsFolder });
	} finally {
		await sql.end();
	}
}

if (import.meta.main) {
	const url = process.env.DB_CONNECTION;
	if (!url) {
		console.error('DB_CONNECTION is not set.');
		process.exit(1);
	}
	try {
		await migrateDatabase(url);
		console.info('Migrations applied.');
	} catch (e) {
		console.error(e);
		process.exit(1);
	}
}
