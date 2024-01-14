import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import { DB_CONNECTION } from '$env/static/private';
import * as authSchema from './schema/auth'
import * as metricSchema from './schema/metric';
import * as movieSchema from './schema/movie';

export function migrateDatabase () {
    // for migrations
    const migrationClient = postgres(DB_CONNECTION, { max: 1 });
    migrate(drizzle(migrationClient), { migrationsFolder: './db/migrations'});
}

// for query purposes
const queryClient = postgres(DB_CONNECTION);
export default drizzle(queryClient, { schema: {
    ...metricSchema,
    ...movieSchema,
    ...authSchema
}});