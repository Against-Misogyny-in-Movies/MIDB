import { eq, getTableColumns, inArray, sql, type SQL } from 'drizzle-orm';
import type { BatchItem } from 'drizzle-orm/batch';
import type { Db } from '../../client.ts';
import { titles } from '../../schema/titles.ts';
import { titleUm, umSource } from '../../schema/sources.ts';
import { chunkForD1 } from '../../lib/chunkForD1.ts';
import { parseUmFeed, UM_FLAG_KEYS, type UmSourceRow } from '../../lib/sources/um-feed.ts';
import { buildCleanTitleIndex, matchUmFilm } from '../../lib/sources/um-match.ts';
import { isMain } from '../../../scripts/lib/is-main.ts';
import { runBatches } from './lib/batch.ts';
import { runSync } from './lib/run.ts';
import { stampSync } from './lib/stamp.ts';

// A row binds every column of its table, defaults included.
const SOURCE_COLUMNS = Object.keys(getTableColumns(umSource)).length;
const BINDING_COLUMNS = Object.keys(getTableColumns(titleUm)).length;
const UNMATCHED_LINES_SHOWN = 200;
/** A run that would delete a larger share of the stored `um_source` rows than this is refused. */
export const MAX_DELETED_SHARE = 0.1;

// Columns the upsert overwrites from the incoming row, as `excluded.<column>` assignments.
const UPSERT_KEYS = [
	'cleanName',
	'cleanTitleKey',
	'year',
	...UM_FLAG_KEYS,
	'comment',
	'sourceUpdatedAt'
] as const;
const sourceColumns = getTableColumns(umSource);
const UPSERT_SET = Object.fromEntries(
	UPSERT_KEYS.map((key) => [key, sql.raw(`excluded.${sourceColumns[key].name}`)])
) as Record<(typeof UPSERT_KEYS)[number], SQL>;

export interface UmSyncResult {
	/** Films and series in the feed. */
	feedRows: number;
	inserted: number;
	updated: number;
	deleted: number;
	/** UM films that matched a film, and the bindings that came of them. */
	matchedFilms: number;
	bindings: number;
	bindingsWritten: number;
	bindingsRemoved: number;
	ambiguous: number;
	noMatch: number;
}

/**
 * Syncs `um_source` and `title_um` to the UM feed, writing only what differs:
 *
 * - rows are upserted when the feed's `updatedAt` is newer than the stored `source_updated_at`,
 *   or when a column MIDB derives (`clean_name`, `clean_title_key`, `year`) differs;
 * - rows missing from the feed are deleted, their bindings first (`title_um.um_id` has no cascade);
 * - bindings are recomputed for every UM film against the film titles and diffed, so a new or
 *   renamed item, or a film added by the Bechdel sync, is bound without a separate pass.
 *
 * Before any write, a feed with no films, no series, or one that would remove more than
 * `MAX_DELETED_SHARE` of the stored rows throws, so a renamed item type or a partial feed
 * cannot empty the table or stamp a success.
 */
export async function syncUm(
	db: Db,
	feed: unknown,
	{ now = new Date(), log = console.log }: { now?: Date; log?: (line: string) => void } = {}
): Promise<UmSyncResult> {
	const parsed = parseUmFeed(feed);
	if (parsed.length === 0) {
		throw new Error('The Unconsenting Media feed has no films or series; nothing was changed.');
	}
	const rows = [...new Map(parsed.map((row) => [row.umId, row])).values()].sort(
		(a, b) => a.umId - b.umId
	);

	for (const kind of ['movie', 'tv'] as const) {
		if (!rows.some((row) => row.kind === kind)) {
			throw new Error(
				`The Unconsenting Media feed has no ${kind === 'movie' ? 'films' : 'series'}; nothing was changed.`
			);
		}
	}

	const stored = new Map(
		(
			await db
				.select({
					umId: umSource.umId,
					at: umSource.sourceUpdatedAt,
					cleanName: umSource.cleanName,
					cleanTitleKey: umSource.cleanTitleKey,
					year: umSource.year
				})
				.from(umSource)
		).map((r) => [r.umId, r])
	);
	const inFeed = new Set(rows.map((r) => r.umId));
	const deletedIds = [...stored.keys()].filter((id) => !inFeed.has(id));
	if (deletedIds.length > stored.size * MAX_DELETED_SHARE) {
		throw new Error(
			`The Unconsenting Media feed would remove ${deletedIds.length} of ${stored.size} stored ` +
				`entries, over the ${MAX_DELETED_SHARE * 100}% limit; nothing was changed.`
		);
	}
	// A row is written when the feed's `updatedAt` is newer, or when a column MIDB computes from
	// the feed's name and year differs, so a matcher fix reaches rows the feed has not touched.
	const upserts = rows.filter((row) => {
		const have = stored.get(row.umId);
		if (!have) return true;
		return (
			have.at === null ||
			row.sourceUpdatedAt.getTime() > have.at.getTime() ||
			have.cleanName !== row.cleanName ||
			have.cleanTitleKey !== row.cleanTitleKey ||
			have.year !== row.year
		);
	});

	const bindings = await planBindings(db, rows);
	const statements: BatchItem<'sqlite'>[] = [];

	// Order matters for the foreign key: bindings go before the rows they point at, and new
	// bindings come after the rows they point at.
	const staleTitleIds = new Set(bindings.stale);
	const orphaned = new Set(deletedIds);
	for (const [titleId, umId] of bindings.current) {
		if (orphaned.has(umId)) staleTitleIds.add(titleId);
	}
	for (const chunk of chunkForD1([...staleTitleIds], 1)) {
		statements.push(db.delete(titleUm).where(inArray(titleUm.titleId, chunk)));
	}
	for (const chunk of chunkForD1(deletedIds, 1)) {
		statements.push(db.delete(umSource).where(inArray(umSource.umId, chunk)));
	}
	for (const chunk of chunkForD1(upserts, SOURCE_COLUMNS)) {
		statements.push(
			db.insert(umSource).values(chunk.map(toSourceInsert)).onConflictDoUpdate({
				target: umSource.umId,
				set: UPSERT_SET
			})
		);
	}
	for (const chunk of chunkForD1(bindings.toWrite, BINDING_COLUMNS)) {
		statements.push(
			db
				.insert(titleUm)
				.values(chunk)
				.onConflictDoUpdate({ target: titleUm.titleId, set: { umId: sql`excluded.um_id` } })
		);
	}
	await runBatches(db, statements);

	const inserted = upserts.filter((row) => !stored.has(row.umId)).length;
	const result: UmSyncResult = {
		feedRows: rows.length,
		inserted,
		updated: upserts.length - inserted,
		deleted: deletedIds.length,
		matchedFilms: bindings.matchedFilms,
		bindings: bindings.desired.size,
		bindingsWritten: bindings.toWrite.length,
		bindingsRemoved: staleTitleIds.size,
		ambiguous: bindings.ambiguous.length,
		noMatch: bindings.noMatch.length
	};
	await stampSync(
		db,
		'um',
		result.inserted +
			result.updated +
			result.deleted +
			result.bindingsWritten +
			result.bindingsRemoved,
		now
	);

	log(
		`Unconsenting Media: ${result.feedRows} films and series in the feed; ` +
			`${result.inserted} added, ${result.updated} updated, ${result.deleted} removed.`
	);
	log(
		`  Films matched: ${result.matchedFilms} (${result.bindings} bindings, ` +
			`${result.bindingsWritten} written, ${result.bindingsRemoved} removed); ` +
			`ambiguous: ${result.ambiguous}; no match: ${result.noMatch}.`
	);
	const unmatched = [...bindings.ambiguous, ...bindings.noMatch];
	if (unmatched.length > 0) {
		log('  Unmatched films (um_id, name, year, reason, candidate years):');
		for (const line of unmatched.slice(0, UNMATCHED_LINES_SHOWN)) log(`    ${line}`);
		if (unmatched.length > UNMATCHED_LINES_SHOWN) {
			log(`    ... and ${unmatched.length - UNMATCHED_LINES_SHOWN} more`);
		}
	}
	return result;
}

function toSourceInsert(row: UmSourceRow): typeof umSource.$inferInsert {
	const { kind: _kind, ...columns } = row;
	return columns;
}

interface BindingPlan {
	/** titleId → umId for every film that matched. */
	desired: Map<string, number>;
	/** What `title_um` holds now. */
	current: Map<string, number>;
	toWrite: { titleId: string; umId: number }[];
	/** Bindings that no longer match anything. */
	stale: string[];
	matchedFilms: number;
	ambiguous: string[];
	noMatch: string[];
}

/** The bindings the films and the feed imply, against those stored. One UM film per title: the highest id wins. */
async function planBindings(db: Db, rows: readonly UmSourceRow[]): Promise<BindingPlan> {
	const films = await db
		.select({ id: titles.id, cleanTitle: titles.cleanTitle, year: titles.year })
		.from(titles)
		.where(eq(titles.kind, 'movie'));
	const index = buildCleanTitleIndex(films);
	const current = new Map(
		(await db.select({ titleId: titleUm.titleId, umId: titleUm.umId }).from(titleUm)).map((r) => [
			r.titleId,
			r.umId
		])
	);

	const desired = new Map<string, number>();
	const ambiguous: string[] = [];
	const noMatch: string[] = [];
	let matchedFilms = 0;
	for (const row of rows) {
		// Series are bound at read time by the candidate picker; only the catalogue is stored.
		if (row.kind !== 'movie') continue;
		const match = matchUmFilm(index, row.cleanTitleKey, row.year);
		const label = `${row.umId}\t${row.cleanName}\t${row.year ?? ''}`;
		if (match.kind === 'matched') {
			matchedFilms++;
			desired.set(match.titleId, row.umId);
		} else if (match.kind === 'ambiguous') {
			ambiguous.push(`${label}\tambiguous\t${match.candidateYears.map((y) => y ?? '').join(',')}`);
		} else {
			noMatch.push(`${label}\tno_match`);
		}
	}

	const toWrite = [...desired]
		.filter(([titleId, umId]) => current.get(titleId) !== umId)
		.map(([titleId, umId]) => ({ titleId, umId }));
	const stale = [...current.keys()].filter((titleId) => !desired.has(titleId));
	return { desired, current, toWrite, stale, matchedFilms, ambiguous, noMatch };
}

if (isMain(import.meta.url)) {
	await runSync(process.argv.slice(2), async (db, sources) => {
		await syncUm(db, await sources.umFeed());
	});
}
