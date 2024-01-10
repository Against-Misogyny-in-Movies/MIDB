import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import { DB_CONNECTION } from '$env/static/private';

// for migrations
const migrationClient = postgres(DB_CONNECTION, { max: 1 });
migrate(drizzle(migrationClient), { migrationsFolder: './db/migrations'});

// for query purposes
const queryClient = postgres(DB_CONNECTION);
export default drizzle(queryClient);