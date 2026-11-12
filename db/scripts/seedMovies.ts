import { createReadStream } from 'node:fs';
import { parse } from 'csv-parse';
import { getTableColumns, sql } from 'drizzle-orm';
import type { Db } from '../client.ts';
import { titles } from '../schema/titles.ts';
import { titleBechdel } from '../schema/sources.ts';
import { normalizeTitle } from '../lib/normalizeTitle.ts';
import { chunkForD1 } from '../lib/chunkForD1.ts';
import { checkCsvColumns } from './lib/checkCsvColumns.ts';
import { isMain } from '../../scripts/lib/is-main.ts';

const CSV_PATH = './db/seeds/sources/bechdel.csv';
const REQUIRED_COLUMNS = ['title', 'year', 'imdbid', 'id', 'bechdelRating'];
// A row binds every column of its table, defaults included.
const TITLE_COLUMNS = Object.keys(getTableColumns(titles)).length;
const BECHDEL_COLUMNS = Object.keys(getTableColumns(titleBechdel)).length;
const BATCH_SIZE = 1000;

interface BechdelRow {
	title: string;
	year: string;
	imdbid: string;
	id: string;
	bechdelRating: string;
}

type TitleInsert = typeof titles.$inferInsert & { imdbId: string };
type BechdelPending = { _imdbId: string; bechdelId: number; rating: number };

function toImdbId(raw: string): string {
	const n = Math.round(parseFloat(raw));
	return `tt${String(n).padStart(7, '0')}`;
}

async function flushBatch(db: Db, titleBatch: TitleInsert[], bechdelBatch: BechdelPending[]) {
	// Deduplicate by imdbId within the batch (CSV has occasional duplicates)
	const dedupedTitles = [...new Map(titleBatch.map((t) => [t.imdbId, t])).values()];
	const dedupedBechdel = [...new Map(bechdelBatch.map((b) => [b._imdbId, b])).values()];

	// One statement per chunk: D1 caps a statement at 100 bound parameters. The seed is
	// idempotent, so a run that stops part way is finished by running it again.
	const idMap = new Map<string, string>();
	for (const chunk of chunkForD1(dedupedTitles, TITLE_COLUMNS)) {
		const inserted = await db
			.insert(titles)
			.values(chunk)
			.onConflictDoUpdate({
				target: titles.imdbId,
				set: {
					title: sql`excluded.title`,
					year: sql`excluded.year`,
					cleanTitle: sql`excluded.clean_title`,
					updatedAt: new Date()
				}
			})
			.returning({ id: titles.id, imdbId: titles.imdbId });
		for (const r of inserted) idMap.set(r.imdbId!, r.id);
	}

	const bechdelRows = dedupedBechdel.flatMap((b) => {
		const titleId = idMap.get(b._imdbId);
		return titleId ? [{ titleId, bechdelId: b.bechdelId, rating: b.rating }] : [];
	});

	for (const chunk of chunkForD1(bechdelRows, BECHDEL_COLUMNS)) {
		await db
			.insert(titleBechdel)
			.values(chunk)
			.onConflictDoUpdate({
				target: titleBechdel.titleId,
				set: { bechdelId: sql`excluded.bechdel_id`, rating: sql`excluded.rating` }
			});
	}
}

/** Upsert `titles` (kind movie, keyed by IMDb id) and `title_bechdel` from a Bechdel CSV. */
export async function seedMovies(db: Db, csvPath: string) {
	console.log('Seeding titles + bechdel from', csvPath);
	await checkCsvColumns(csvPath, REQUIRED_COLUMNS);

	const titleBatch: TitleInsert[] = [];
	const bechdelBatch: BechdelPending[] = [];
	let total = 0;
	let skipped = 0;

	const parser = createReadStream(csvPath).pipe(
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
		const parsedYear = parseInt(record.year, 10);
		const year = parsedYear > 0 ? parsedYear : null; // null = unknown, never 0
		const bechdelId = parseInt(record.id, 10);

		titleBatch.push({ kind: 'movie', imdbId, title, year, cleanTitle: normalizeTitle(title) });
		bechdelBatch.push({ _imdbId: imdbId, bechdelId, rating });

		if (titleBatch.length >= BATCH_SIZE) {
			const batchLen = titleBatch.length;
			await flushBatch(db, titleBatch, bechdelBatch);
			total += batchLen;
			console.log(`  inserted/updated ${total} rows...`);
			titleBatch.length = 0;
			bechdelBatch.length = 0;
		}
	}

	if (titleBatch.length > 0) {
		await flushBatch(db, titleBatch, bechdelBatch);
		total += titleBatch.length;
	}

	console.log(`Done. Total: ${total}, skipped: ${skipped}`);
	return { total, skipped };
}

if (isMain(import.meta.url)) {
	const { openScriptDb } = await import('./lib/db.ts');
	const { parseTarget } = await import('./lib/args.ts');
	const { db, close } = await openScriptDb(parseTarget(process.argv.slice(2)));
	try {
		await seedMovies(db, CSV_PATH);
	} finally {
		await close();
	}
}
