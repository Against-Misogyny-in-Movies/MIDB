import { getPlatformProxy } from 'wrangler';
import { createDb, type Db } from '../../client.ts';
import type { ScriptTarget } from './args.ts';
import { createRemoteDb } from './remote-d1.ts';

/**
 * A script's client over a D1 database. `local` (the default) is the one `wrangler dev` and
 * `vite dev` use, in `.wrangler/state`; `remote` goes over the Cloudflare API with the
 * `CLOUDFLARE_*` variables. Close it so the process can exit.
 */
export async function openScriptDb(
	target: ScriptTarget = 'local'
): Promise<{ db: Db; close: () => Promise<void> }> {
	if (target === 'remote') {
		return { db: createRemoteDb(process.env), close: async () => {} };
	}
	const proxy = await getPlatformProxy<{ DB: D1Database }>();
	return { db: createDb(proxy.env.DB), close: () => proxy.dispose() };
}
