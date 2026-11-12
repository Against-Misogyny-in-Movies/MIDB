import { eq, getTableColumns, isNotNull, sql } from 'drizzle-orm';
import type { BatchItem } from 'drizzle-orm/batch';
import type { Db } from '../../client.ts';
import { titles } from '../../schema/titles.ts';
import { titleBechdel } from '../../schema/sources.ts';
import { normalizeTitle } from '../../lib/normalizeTitle.ts';
import { chunkForD1 } from '../../lib/chunkForD1.ts';
import {
	BECHDEL_FIRST_YEAR,
	parseBechdelRss,
	readBechdelYear,
	type BechdelFilm
} from '../../lib/sources/bechdel-html.ts';
import { isMain } from '../../../scripts/lib/is-main.ts';
import { runBatches } from './lib/batch.ts';
import { runSync } from './lib/args.ts';
import type { SyncSources } from './lib/sources.ts';
import { lastSync, stampSync } from './lib/stamp.ts';

// A row binds every column of its table, defaults included.
const TITLE_COLUMNS = Object.keys(getTableColumns(titles)).length;
const BECHDEL_COLUMNS = Object.keys(getTableColumns(titleBechdel)).length;
/** The daily run reads this many years up to and including the current one. */
const RECENT_YEARS = 3;

export interface BechdelSyncResult {
	full: boolean;
	years: number;
	films: number;
	titlesInserted: number;
	titlesUpdated: number;
	ratingsWritten: number;
}

/**
 * Syncs `titles` (films, keyed by IMDb id) and `title_bechdel` to the Bechdel Test site, writing
 * only what differs. The daily run reads the recent-additions feed and the last three year
 * pages; the full sweep reads every year from the first. A database that has never synced
 * sweeps in full. Everything is read before anything is written, and a run that reads no
 * films throws, so a changed site cannot empty or half-fill the tables.
 */
export async function syncBechdel(
	db: Db,
	sources: Pick<SyncSources, 'bechdelRss' | 'bechdelYear'>,
	{
		full = false,
		now = new Date(),
		log = console.log
	}: { full?: boolean; now?: Date; log?: (line: string) => void } = {}
): Promise<BechdelSyncResult> {
	const sweep = full || (await lastSync(db, 'bechdel')) === null;
	const thisYear = now.getUTCFullYear();

	let years: number[];
	let recentIds: number[] = [];
	if (sweep) {
		years = Array.from(
			{ length: thisYear - BECHDEL_FIRST_YEAR + 1 },
			(_, i) => BECHDEL_FIRST_YEAR + i
		);
	} else {
		const recent = parseBechdelRss(await sources.bechdelRss());
		recentIds = recent.map((film) => film.bechdelId);
		years = [
			...new Set([
				...Array.from({ length: RECENT_YEARS }, (_, i) => thisYear - i),
				...recent.map((film) => film.year)
			])
		].sort((a, b) => a - b);
	}

	const byImdb = new Map<string, BechdelFilm>();
	for (const year of years) {
		for (const film of await readBechdelYear(sources.bechdelYear, year))
			byImdb.set(film.imdbId, film);
	}
	if (byImdb.size === 0) {
		throw new Error('The Bechdel Test pages gave no films; nothing was changed.');
	}

	const seenIds = new Set([...byImdb.values()].map((film) => film.bechdelId));
	const notYetListed = recentIds.filter((id) => !seenIds.has(id)).length;

	const existing = new Map(
		(
			await db
				.select({
					id: titles.id,
					imdbId: titles.imdbId,
					title: titles.title,
					cleanTitle: titles.cleanTitle,
					year: titles.year,
					bechdelId: titleBechdel.bechdelId,
					rating: titleBechdel.rating
				})
				.from(titles)
				.leftJoin(titleBechdel, eq(titleBechdel.titleId, titles.id))
				.where(isNotNull(titles.imdbId))
		).map((row) => [row.imdbId!, row])
	);

	const newTitles: (typeof titles.$inferInsert)[] = [];
	const retitled: { id: string; title: string; cleanTitle: string; year: number }[] = [];
	const ratings: (typeof titleBechdel.$inferInsert)[] = [];
	for (const film of byImdb.values()) {
		const cleanTitle = normalizeTitle(film.title);
		const have = existing.get(film.imdbId);
		if (!have) {
			const id = crypto.randomUUID();
			newTitles.push({
				id,
				kind: 'movie',
				imdbId: film.imdbId,
				title: film.title,
				cleanTitle,
				year: film.year
			});
			ratings.push({ titleId: id, bechdelId: film.bechdelId, rating: film.rating });
			continue;
		}
		if (have.title !== film.title || have.cleanTitle !== cleanTitle || have.year !== film.year) {
			retitled.push({ id: have.id, title: film.title, cleanTitle, year: film.year });
		}
		if (have.bechdelId !== film.bechdelId || have.rating !== film.rating) {
			ratings.push({ titleId: have.id, bechdelId: film.bechdelId, rating: film.rating });
		}
	}

	// New titles go in first: their ratings point at them.
	const statements: BatchItem<'sqlite'>[] = [];
	for (const chunk of chunkForD1(newTitles, TITLE_COLUMNS)) {
		statements.push(db.insert(titles).values(chunk));
	}
	for (const { id, ...set } of retitled) {
		statements.push(db.update(titles).set(set).where(eq(titles.id, id)));
	}
	for (const chunk of chunkForD1(ratings, BECHDEL_COLUMNS)) {
		statements.push(
			db
				.insert(titleBechdel)
				.values(chunk)
				.onConflictDoUpdate({
					target: titleBechdel.titleId,
					set: { bechdelId: sql`excluded.bechdel_id`, rating: sql`excluded.rating` }
				})
		);
	}
	await runBatches(db, statements);

	const result: BechdelSyncResult = {
		full: sweep,
		years: years.length,
		films: byImdb.size,
		titlesInserted: newTitles.length,
		titlesUpdated: retitled.length,
		ratingsWritten: ratings.length
	};
	await stampSync(db, 'bechdel', newTitles.length + retitled.length + ratings.length, now);
	log(
		`Bechdel Test (${sweep ? 'full sweep' : 'recent years'}, ${result.years} years): ` +
			`${result.films} films read; ${result.titlesInserted} added, ${result.titlesUpdated} retitled, ` +
			`${result.ratingsWritten} ratings written.`
	);
	if (notYetListed > 0) {
		log(`  ${notYetListed} films in the recent-additions feed are not on their year page yet.`);
	}
	return result;
}

if (isMain(import.meta.url)) {
	await runSync(process.argv.slice(2), async (db, sources, args) => {
		await syncBechdel(db, sources, { full: args.full });
	});
}
