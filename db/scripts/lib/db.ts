import { createDb } from '../../client';

// Script-side client; Bun loads `.env` into process.env. postgres-js would quietly fall back
// to localhost on an undefined URL, so fail first.
if (!process.env.DB_CONNECTION) throw new Error('DB_CONNECTION is not set.');
const client = createDb(process.env.DB_CONNECTION!);

export const db = client.db;

/** Close the pool so the script's process can exit. */
export function closeDb(): Promise<void> {
	return client.sql.end();
}
