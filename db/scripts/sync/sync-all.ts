import { isMain } from '../../../scripts/lib/is-main.ts';
import { backfillTmdb } from '../backfillTmdb.ts';
import { runSync } from './lib/args.ts';
import { syncBechdel } from './sync-bechdel.ts';
import { syncPopularity } from './sync-popularity.ts';
import { syncUm } from './sync-um.ts';

/**
 * Every source in the order the data depends on: Unconsenting Media, the Bechdel Test, TMDB ids
 * for the new films, then popularity. The TMDB steps need `TMDB_API_TOKEN` and are skipped with
 * a notice without it, so a contributor needs no account. `--fixtures` reads the test fixtures
 * and never calls TMDB's API.
 */
if (isMain(import.meta.url)) {
	await runSync(process.argv.slice(2), async (db, sources, args) => {
		await syncUm(db, await sources.umFeed());
		await syncBechdel(db, sources, { full: args.full });

		const token = process.env.TMDB_API_TOKEN;
		if (!token) {
			console.log(
				'TMDB_API_TOKEN is not set: skipping the TMDB id backfill and the popularity sync.'
			);
			return;
		}
		if (args.fixtures) console.log('--fixtures reads no TMDB API: skipping the TMDB id backfill.');
		else await backfillTmdb(db, token);
		await syncPopularity(db, sources);
	});
}
