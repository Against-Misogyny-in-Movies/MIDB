import { createDb, type Db } from '#db/client.ts';
import { env } from '#lib/server/env.ts';

/**
 * The app's Drizzle client over the Worker's D1 binding (`DB`). D1 is a binding, not a socket,
 * so the client is built on first use and rebuilt only when the binding changes. Nothing is
 * read at build time, so `build` and `check` need no database.
 */
let override: D1Database | undefined;
let current: { d1: D1Database; client: Db } | undefined;

function connect(): Db {
	const d1 = override ?? env.DB;
	if (!d1) throw new Error('The D1 binding "DB" is not available: add it to wrangler.jsonc.');
	if (current?.d1 !== d1) current = { d1, client: createDb(d1) };
	return current.client;
}

export const db: Db = new Proxy({} as Db, {
	get(_target, prop) {
		const real = connect();
		const value = Reflect.get(real, prop, real);
		return typeof value === 'function' ? value.bind(real) : value;
	}
});

/** Use this D1 database instead of the Worker's binding (tests and scripts). `undefined` unbinds. */
export function bindDb(d1: D1Database | undefined): void {
	override = d1;
}
