import { createReadStream, createWriteStream } from 'fs';
import { parse } from 'csv-parse';
import { sql } from 'drizzle-orm';
import db from '../connections';
import { movies, movieUnconsenting, umSource } from '../schema/movie';
import { normalizeTitle, stripTrailingYear } from './lib/normalizeTitle';
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

// Map from cleanTitle → Array of { id, year }
async function buildCleanTitleIndex(): Promise<Map<string, Array<{ id: string; year: number }>>> {
	const rows = await db.select({ id: movies.id, cleanTitle: movies.cleanTitle, year: movies.year }).from(movies);
	const index = new Map<string, Array<{ id: string; year: number }>>();
	for (const r of rows) {
		const existing = index.get(r.cleanTitle);
		if (existing) {
			existing.push({ id: r.id, year: r.year });
		} else {
			index.set(r.cleanTitle, [{ id: r.id, year: r.year }]);
		}
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
	report.write('id\tname\tcleanNameArticles\tyearOfRelease\treason\tcandidateYears\n');

	const sourceBatch: (typeof umSource.$inferInsert)[] = [];
	const bindingBatch: (typeof movieUnconsenting.$inferInsert)[] = [];
	let matched = 0;
	let unmatched = 0;
	let ambiguous = 0;
	let skipped = 0;
	let total = 0;

	const flushSource = async () => {
		if (sourceBatch.length === 0) return;
		const deduped = [...new Map(sourceBatch.map((r) => [r.umId, r])).values()];
		await db
			.insert(umSource)
			.values(deduped)
			.onConflictDoUpdate({
				target: umSource.umId,
				set: {
					cleanName: sql`excluded.clean_name`,
					cleanTitleKey: sql`excluded.clean_title_key`,
					year: sql`excluded.year`,
					noRape: sql`excluded.no_rape`,
					rapeMenDisImp: sql`excluded.rape_men_dis_imp`,
					sexHarOnScrn: sql`excluded.sex_har_on_scrn`,
					sexAdultTeen: sql`excluded.sex_adult_teen`,
					childSexAbuse: sql`excluded.child_sex_abuse`,
					incest: sql`excluded.incest`,
					attemptedRape: sql`excluded.attempted_rape`,
					rapeOffScrn: sql`excluded.rape_off_scrn`,
					rapeOnScreen: sql`excluded.rape_on_screen`,
					comment: sql`excluded.comment`,
				},
			});
		sourceBatch.length = 0;
	};

	const flushBindings = async () => {
		if (bindingBatch.length === 0) return;
		const deduped = [...new Map(bindingBatch.map((r) => [r.movieId, r])).values()];
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
		bindingBatch.length = 0;
	};

	const parser = createReadStream(CSV_PATH).pipe(
		parse({ columns: true, skip_empty_lines: true, trim: true, relax_column_count: true })
	);

	for await (const record of parser as AsyncIterable<UmRow>) {
		total++;

		const itemTypeLower = record.itemType?.toLowerCase();
		if (itemTypeLower !== 'movie' && itemTypeLower !== 'tv show') {
			skipped++;
			continue;
		}

		const umId = parseInt(record.id, 10);
		if (isNaN(umId)) {
			skipped++;
			continue;
		}

		// Derive the canonical key and year from UM's own normalized name.
		// UM's cleanNameArticles may include a trailing year ("wuthering heights 2026"),
		// so we strip it to get a stable key and use the embedded year preferentially.
		const rawKey = record.cleanNameArticles?.trim() || record.cleanName?.trim() || normalizeTitle(record.name?.trim() || '');
		const { key: titleKey, year: embeddedYear } = stripTrailingYear(rawKey);
		const csvYear = record.yearOfRelease ? parseInt(record.yearOfRelease, 10) : null;
		const umYear = embeddedYear ?? (Number.isNaN(csvYear) ? null : csvYear);
		const displayName = record.cleanNameArticles?.trim() || record.cleanName?.trim() || record.name?.trim() || '';

		// Populate um_source catalog regardless of match outcome
		const flags = {
			noRape: parseBool(record.noRape),
			rapeMenDisImp: parseBool(record.rapeMenDisImp),
			sexHarOnScrn: parseBool(record.sexHarOnScrn),
			sexAdultTeen: parseBool(record.sexAdultTeen),
			childSexAbuse: parseBool(record.childSexAbuse),
			incest: parseBool(record.incest),
			attemptedRape: parseBool(record.attemptedRape),
			rapeOffScrn: parseBool(record.rapeOffScrn),
			rapeOnScreen: parseBool(record.rapeOnScreen),
		};
		sourceBatch.push({
			umId,
			cleanName: displayName,
			cleanTitleKey: titleKey,
			year: umYear,
			...flags,
			comment: record.comment?.trim() || null,
		});

		// TV shows have no movies spine row — only populate um_source, skip binding
		if (itemTypeLower === 'tv show') continue;

		// Resolve a binding to a movies row
		const candidates = titleIndex.get(titleKey) ?? [];

		let movieId: string | undefined;
		if (candidates.length === 1) {
			// Unambiguous: only one movie with this title
			movieId = candidates[0].id;
		} else if (candidates.length > 1 && umYear !== null) {
			// Try exact year match
			const byYear = candidates.find((c) => c.year === umYear);
			movieId = byYear?.id;
		}
		// else: ambiguous (multiple same-title, no year hit) — leave unmatched

		if (!movieId) {
			if (candidates.length > 1) {
				ambiguous++;
				const candidateYears = candidates.map((c) => c.year).join(',');
				report.write(`${record.id}\t${record.name}\t${record.cleanNameArticles}\t${record.yearOfRelease}\tambiguous\t${candidateYears}\n`);
			} else {
				unmatched++;
				report.write(`${record.id}\t${record.name}\t${record.cleanNameArticles}\t${record.yearOfRelease}\tno_match\t\n`);
			}
		} else {
			matched++;
			bindingBatch.push({
				movieId,
				umId,
				cleanName: displayName,
				itemType: record.itemType?.trim() || null,
				comment: record.comment?.trim() || null,
				...flags,
			});
		}

		if (sourceBatch.length >= BATCH_SIZE) {
			await flushSource();
			await flushBindings();
			console.log(`  processed ${total} rows, matched ${matched}...`);
		}
	}

	await flushSource();
	await flushBindings();
	report.end();

	console.log(`Done.`);
	console.log(`  Total rows: ${total}`);
	console.log(`  Movies matched: ${matched}`);
	console.log(`  Ambiguous (skipped): ${ambiguous}`);
	console.log(`  No match: ${unmatched}`);
	console.log(`  Skipped (non-movie/invalid): ${skipped}`);
	console.log(`  Unmatched report: ${UNMATCHED_REPORT}`);
}

await main();
process.exit(0);
