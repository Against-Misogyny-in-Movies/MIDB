import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import * as authSchema from './schema/auth';
import * as movieSchema from './schema/movie';
import * as communitySchema from './schema/community';

const DB_CONNECTION =
	process.env.DB_CONNECTION || 'postgres://postgres:postgres@localhost:5432/postgres';

const migrationsFolder = new URL('./migrations', import.meta.url).pathname;

export async function migrateDatabase() {
	console.info(`Migrating database at ${DB_CONNECTION}`);
	const migrationClient = postgres(DB_CONNECTION, { max: 1, connect_timeout: 10 });
	try {
		await migrate(drizzle(migrationClient), { migrationsFolder });
	} finally {
		await migrationClient.end();
	}
}

// for query purposes
const queryClient = postgres(DB_CONNECTION, { connect_timeout: 10 });
export default drizzle(queryClient, {
	schema: {
		...movieSchema,
		...authSchema,
		...communitySchema
	}
});
