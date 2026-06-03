import { createReadStream } from 'fs';
import { parse } from 'csv-parse';
import { sql } from 'drizzle-orm';
import db from '../connections';
import { movies, movieBechdel } from '../schema/movie';
import { normalizeTitle } from './lib/normalizeTitle';
import { checkCsvColumns } from './lib/checkCsvColumns';

const CSV_PATH = './db/seeds/sources/bechdel.csv';
const REQUIRED_COLUMNS = ['title', 'year', 'imdbid', 'id', 'bechdelRating', 'numVotes'];
const BATCH_SIZE = 1000;

interface BechdelRow {
	title: string;
	year: string;
	imdbid: string;
	id: string;
	bechdelRating: string;
	numVotes: string;
}

function toImdbId(raw: string): string {
	const n = Math.round(parseFloat(raw));
	return `tt${String(n).padStart(7, '0')}`;
}

async function flushBatch(
	movieBatch: (typeof movies.$inferInsert)[],
	bechdelBatch: { _imdbId: string; bechdelId: number; rating: number; numVotes: number }[]
) {
	// Deduplicate by imdbId within the batch (CSV has occasional duplicates)
	const movieMap = new Map<string, typeof movies.$inferInsert>();
	for (const m of movieBatch) movieMap.set(m.imdbId, m);
	const bechdelMap = new Map<string, (typeof bechdelBatch)[number]>();
	for (const b of bechdelBatch) bechdelMap.set(b._imdbId, b);
	const dedupedMovies = [...movieMap.values()];
	const dedupedBechdel = [...bechdelMap.values()];

	const inserted = await db
		.insert(movies)
		.values(dedupedMovies)
		.onConflictDoUpdate({
			target: movies.imdbId,
			set: {
				title: sql`excluded.title`,
				year: sql`excluded.year`,
				cleanTitle: sql`excluded.clean_title`,
				updatedAt: sql`now()`,
			},
		})
		.returning({ id: movies.id, imdbId: movies.imdbId });

	const idMap = Object.fromEntries(inserted.map((r) => [r.imdbId, r.id]));

	const bechdelRows = dedupedBechdel
		.map((b) => {
			const movieId = idMap[b._imdbId];
			return movieId
				? { movieId, bechdelId: b.bechdelId, rating: b.rating, numVotes: b.numVotes }
				: null;
		})
		.filter((b): b is typeof movieBechdel.$inferInsert => b !== null);

	if (bechdelRows.length > 0) {
		await db
			.insert(movieBechdel)
			.values(bechdelRows)
			.onConflictDoUpdate({
				target: movieBechdel.movieId,
				set: {
					bechdelId: sql`excluded.bechdel_id`,
					rating: sql`excluded.rating`,
					numVotes: sql`excluded.num_votes`,
				},
			});
	}
}

async function main() {
	console.log('Seeding movies + bechdel from', CSV_PATH);
	await checkCsvColumns(CSV_PATH, REQUIRED_COLUMNS);

	const movieBatch: (typeof movies.$inferInsert)[] = [];
	const bechdelBatch: { _imdbId: string; bechdelId: number; rating: number; numVotes: number }[] = [];
	let total = 0;
	let skipped = 0;

	const parser = createReadStream(CSV_PATH).pipe(
		parse({ columns: true, skip_empty_lines: true, trim: true })
	);

	for await (const record of parser as AsyncIterable<BechdelRow>) {
		const rawImdbId = record.imdbid?.trim();
		const rawRating = record.bechdelRating?.trim();

		if (!rawImdbId || isNaN(parseFloat(rawImdbId))) {
			skipped++;
			continue;
		}

		const rating = parseInt(rawRating, 10);
		if (isNaN(rating) || rating < 0 || rating > 3) {
			skipped++;
			continue;
		}

		const imdbId = toImdbId(rawImdbId);
		const title = record.title?.trim() || '';
		const year = parseInt(record.year, 10);
		const bechdelId = parseInt(record.id, 10);
		const numVotes = Math.round(parseFloat(record.numVotes || '0'));

		movieBatch.push({ imdbId, title, year, cleanTitle: normalizeTitle(title) });
		bechdelBatch.push({ _imdbId: imdbId, bechdelId, rating, numVotes });

		if (movieBatch.length >= BATCH_SIZE) {
			const batchLen = movieBatch.length;
			await flushBatch(movieBatch, bechdelBatch);
			total += batchLen;
			console.log(`  inserted/updated ${total} rows...`);
			movieBatch.length = 0;
			bechdelBatch.length = 0;
		}
	}

	if (movieBatch.length > 0) {
		await flushBatch(movieBatch, bechdelBatch);
		total += movieBatch.length;
	}

	console.log(`Done. Total: ${total}, skipped: ${skipped}`);
}

await main();
process.exit(0);
