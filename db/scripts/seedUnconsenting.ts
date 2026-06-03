import { createReadStream, createWriteStream } from 'fs';
import { parse } from 'csv-parse';
import { sql } from 'drizzle-orm';
import { eq } from 'drizzle-orm';
import db from '../connections';
import { movies, movieUnconsenting } from '../schema/movie';
import { normalizeTitle } from './lib/normalizeTitle';
import { checkCsvColumns } from './lib/checkCsvColumns';

const CSV_PATH = './db/seeds/sources/unconsenting.csv';
const REQUIRED_COLUMNS = [
	'id', 'name', 'cleanName', 'cleanNameArticles', 'itemType', 'comment', 'yearOfRelease',
	'noRape', 'rapeMenDisImp', 'sexHarOnScrn', 'sexAdultTeen', 'childSexAbuse',
	'incest', 'attemptedRape', 'rapeOffScrn', 'rapeOnScreen',
];
const UNMATCHED_REPORT = './db/seeds/sources/unconsenting_unmatched.txt';
const BATCH_SIZE = 500;

interface UmRow {
	id: string;
	name: string;
	cleanName: string;
	cleanNameArticles: string;
	altName: string;
	itemType: string;
	comment: string;
	yearOfRelease: string;
	noRape: string;
	rapeMenDisImp: string;
	sexHarOnScrn: string;
	sexAdultTeen: string;
	childSexAbuse: string;
	incest: string;
	attemptedRape: string;
	rapeOffScrn: string;
	rapeOnScreen: string;
}

function parseBool(val: string): boolean {
	return val?.toLowerCase() === 'true';
}

async function buildCleanTitleIndex(): Promise<Map<string, string>> {
	const rows = await db.select({ id: movies.id, cleanTitle: movies.cleanTitle }).from(movies);
	const index = new Map<string, string>();
	for (const r of rows) {
		index.set(r.cleanTitle, r.id);
	}
	return index;
}

async function main() {
	console.log('Checking columns for', CSV_PATH);
	await checkCsvColumns(CSV_PATH, REQUIRED_COLUMNS);
	console.log('Building clean title index from movies...');
	const titleIndex = await buildCleanTitleIndex();
	console.log(`  index size: ${titleIndex.size}`);

	const report = createWriteStream(UNMATCHED_REPORT);
	report.write('id\tname\tcleanNameArticles\tyearOfRelease\treason\n');

	const insertBatch: (typeof movieUnconsenting.$inferInsert)[] = [];
	let matched = 0;
	let unmatched = 0;
	let skipped = 0;
	let total = 0;

	const flush = async () => {
		if (insertBatch.length === 0) return;
		// Deduplicate by movieId within batch
		const deduped = [...new Map(insertBatch.map((r) => [r.movieId, r])).values()];
		await db
			.insert(movieUnconsenting)
			.values(deduped)
			.onConflictDoUpdate({
				target: movieUnconsenting.movieId,
				set: {
					umId: sql`excluded.um_id`,
					cleanName: sql`excluded.clean_name`,
					itemType: sql`excluded.item_type`,
					comment: sql`excluded.comment`,
					noRape: sql`excluded.no_rape`,
					rapeMenDisImp: sql`excluded.rape_men_dis_imp`,
					sexHarOnScrn: sql`excluded.sex_har_on_scrn`,
					sexAdultTeen: sql`excluded.sex_adult_teen`,
					childSexAbuse: sql`excluded.child_sex_abuse`,
					incest: sql`excluded.incest`,
					attemptedRape: sql`excluded.attempted_rape`,
					rapeOffScrn: sql`excluded.rape_off_scrn`,
					rapeOnScreen: sql`excluded.rape_on_screen`,
				},
			});
		insertBatch.length = 0;
	};

	const parser = createReadStream(CSV_PATH).pipe(
		parse({ columns: true, skip_empty_lines: true, trim: true, relax_column_count: true })
	);

	for await (const record of parser as AsyncIterable<UmRow>) {
		total++;

		// Only process movies
		if (record.itemType?.toLowerCase() !== 'movie') {
			skipped++;
			continue;
		}

		const umId = parseInt(record.id, 10);
		if (isNaN(umId)) {
			skipped++;
			continue;
		}

		// Try cleanNameArticles first (strips leading article), then cleanName, then normalized name
		const candidates = [
			record.cleanNameArticles?.trim(),
			record.cleanName?.trim(),
			normalizeTitle(record.name?.trim() || ''),
		].filter(Boolean) as string[];

		let movieId: string | undefined;
		let matchedKey: string | undefined;
		for (const candidate of candidates) {
			const found = titleIndex.get(candidate);
			if (found) {
				movieId = found;
				matchedKey = candidate;
				break;
			}
		}

		if (!movieId) {
			unmatched++;
			report.write(`${record.id}\t${record.name}\t${record.cleanNameArticles}\t${record.yearOfRelease}\tno_match\n`);
			continue;
		}

		matched++;
		insertBatch.push({
			movieId,
			umId,
			cleanName: record.cleanNameArticles?.trim() || record.cleanName?.trim() || '',
			itemType: record.itemType?.trim() || null,
			comment: record.comment?.trim() || null,
			noRape: parseBool(record.noRape),
			rapeMenDisImp: parseBool(record.rapeMenDisImp),
			sexHarOnScrn: parseBool(record.sexHarOnScrn),
			sexAdultTeen: parseBool(record.sexAdultTeen),
			childSexAbuse: parseBool(record.childSexAbuse),
			incest: parseBool(record.incest),
			attemptedRape: parseBool(record.attemptedRape),
			rapeOffScrn: parseBool(record.rapeOffScrn),
			rapeOnScreen: parseBool(record.rapeOnScreen),
		});

		if (insertBatch.length >= BATCH_SIZE) {
			await flush();
			console.log(`  processed ${total} rows, matched ${matched}...`);
		}
	}

	await flush();
	report.end();

	console.log(`Done.`);
	console.log(`  Total rows: ${total}`);
	console.log(`  Movies matched: ${matched}`);
	console.log(`  Unmatched: ${unmatched}`);
	console.log(`  Skipped (non-movie/invalid): ${skipped}`);
	console.log(`  Unmatched report: ${UNMATCHED_REPORT}`);
}

await main();
process.exit(0);
