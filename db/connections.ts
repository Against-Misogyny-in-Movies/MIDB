import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import * as authSchema from './schema/auth';
import * as movieSchema from './schema/movie';

const DB_CONNECTION = process.env.DB_CONNECTION || 'postgres://postgres:postgres@localhost:5432/postgres';

/**
 * Runs all pending Drizzle migrations against the configured Postgres database.
 * Uses a separate single-connection client so it doesn't interfere with the query pool.
 *
 * @returns Resolves when all migrations have been applied successfully.
 */
export async function migrateDatabase () {
    console.info(`Migrating database at ${DB_CONNECTION}`)
    const migrationClient = postgres(DB_CONNECTION, { max: 1 });
    await migrate(drizzle(migrationClient), { migrationsFolder: './db/migrations'});
}

// for query purposes
const queryClient = postgres(DB_CONNECTION);
export default drizzle(queryClient, { schema: {
    ...movieSchema,
    ...authSchema
}});