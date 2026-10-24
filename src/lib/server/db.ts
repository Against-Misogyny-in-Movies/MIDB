import { env } from '$env/dynamic/private';
import { createDb, type Db } from '$db/client';

/**
 * The app's Drizzle client. The connection string is read from the runtime env on first use,
 * never at build time, so `build` and `check` need no database and rotating the URL needs
 * no rebuild. Under Vitest it reads TEST_DB_CONNECTION only, so tests never reach the dev DB.
 */
let client: ReturnType<typeof createDb> | undefined;

function connectionUrl(): string {
	const name = process.env.VITEST ? 'TEST_DB_CONNECTION' : 'DB_CONNECTION';
	const url = env[name];
	if (!url) throw new Error(`${name} is not set: the server has no database connection string.`);
	return url;
}

function connect() {
	client ??= createDb(connectionUrl());
	return client;
}

export const db: Db = new Proxy({} as Db, {
	get(_target, prop) {
		const real = connect().db;
		const value = Reflect.get(real, prop, real);
		return typeof value === 'function' ? value.bind(real) : value;
	}
});

/** Close the pool (tests and scripts). The next use of `db` opens a new one. */
export async function closeDb(): Promise<void> {
	const open = client;
	client = undefined;
	await open?.sql.end();
}
