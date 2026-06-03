import { isNull } from 'drizzle-orm';
import { sql } from 'drizzle-orm';
import db from '../connections';
import { movies } from '../schema/movie';

const TMDB_BASE = process.env.PUBLIC_TMDB_API_URL || 'https://api.themoviedb.org';
const TMDB_TOKEN = process.env.TMDB_API_TOKEN;
const BATCH_SIZE = 50;
const DELAY_MS = 250; // stay under TMDB rate limit (40 req/10s)

if (!TMDB_TOKEN) {
	console.error('TMDB_API_TOKEN env var is required');
	process.exit(1);
}

async function resolveTmdbId(imdbId: string): Promise<number | null> {
	const url = `${TMDB_BASE}/3/find/${imdbId}?external_source=imdb_id`;
	const res = await fetch(url, {
		headers: { Authorization: `Bearer ${TMDB_TOKEN}`, Accept: 'application/json' },
	});
	if (!res.ok) return null;
	const data = await res.json();
	return data?.movie_results?.[0]?.id ?? null;
}

async function main() {
	const toBackfill = await db
		.select({ id: movies.id, imdbId: movies.imdbId })
		.from(movies)
		.where(isNull(movies.tmdbId));

	console.log(`Backfilling TMDB ids for ${toBackfill.length} movies...`);

	let updated = 0;
	let notFound = 0;

	for (let i = 0; i < toBackfill.length; i += BATCH_SIZE) {
		const batch = toBackfill.slice(i, i + BATCH_SIZE);
		for (const row of batch) {
			const tmdbId = await resolveTmdbId(row.imdbId);
			if (tmdbId) {
				await db
					.update(movies)
					.set({ tmdbId, updatedAt: new Date() })
					.where(sql`id = ${row.id}`);
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

await main();
process.exit(0);
