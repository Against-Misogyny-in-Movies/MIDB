import { and, eq, isNotNull, isNull } from 'drizzle-orm';
import { openScriptDb } from './lib/db.ts';
import { parseTarget } from './lib/args.ts';
import type { Db } from '../client.ts';
import { titles } from '../schema/titles.ts';
import { isMain } from '../../scripts/lib/is-main.ts';

const TMDB_BASE = process.env.PUBLIC_TMDB_API_URL || 'https://api.themoviedb.org';
const BATCH_SIZE = 50;
const DELAY_MS = 250; // stay under TMDB rate limit (40 req/10s)

async function resolveTmdbId(imdbId: string, token: string): Promise<number | null> {
	const url = `${TMDB_BASE}/3/find/${imdbId}?external_source=imdb_id`;
	const res = await fetch(url, {
		headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' }
	});
	if (!res.ok) return null;
	const data = (await res.json()) as { movie_results?: { id: number }[] } | null;
	return data?.movie_results?.[0]?.id ?? null;
}

/** Looks up the TMDB id of every film that has an IMDb id and no TMDB id yet. */
export async function backfillTmdb(db: Db, token: string) {
	const toBackfill = await db
		.select({ id: titles.id, imdbId: titles.imdbId })
		.from(titles)
		.where(and(eq(titles.kind, 'movie'), isNull(titles.tmdbId), isNotNull(titles.imdbId)));

	console.log(`Backfilling TMDB ids for ${toBackfill.length} movies...`);

	let updated = 0;
	let notFound = 0;

	for (let i = 0; i < toBackfill.length; i += BATCH_SIZE) {
		const batch = toBackfill.slice(i, i + BATCH_SIZE);
		for (const row of batch) {
			const tmdbId = await resolveTmdbId(row.imdbId!, token);
			if (tmdbId) {
				await db.update(titles).set({ tmdbId }).where(eq(titles.id, row.id));
				updated++;
			} else {
				notFound++;
			}
			await new Promise((r) => setTimeout(r, DELAY_MS));
		}
		console.log(`  processed ${Math.min(i + BATCH_SIZE, toBackfill.length)}/${toBackfill.length}`);
	}

	console.log(`Done. Updated: ${updated}, not found: ${notFound}`);
}

if (isMain(import.meta.url)) {
	const token = process.env.TMDB_API_TOKEN;
	if (!token) {
		console.error('TMDB_API_TOKEN env var is required');
		process.exit(1);
	}
	const { db, close } = await openScriptDb(parseTarget(process.argv.slice(2)));
	try {
		await backfillTmdb(db, token);
	} finally {
		await close();
	}
}
