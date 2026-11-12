import { getPlatformProxy } from 'wrangler';
import { createDb, type Db } from '../../client.ts';

/**
 * A script's client over the local D1 database (the one `wrangler dev` and `vite dev` use,
 * in `.wrangler/state`). Close it so the process can exit.
 */
export async function openScriptDb(): Promise<{ db: Db; close: () => Promise<void> }> {
	const proxy = await getPlatformProxy<{ DB: D1Database }>();
	return { db: createDb(proxy.env.DB), close: () => proxy.dispose() };
}
