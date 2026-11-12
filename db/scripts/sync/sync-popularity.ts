import { eq, isNotNull, sql } from 'drizzle-orm';
import type { BatchItem } from 'drizzle-orm/batch';
import type { Db } from '../../client.ts';
import { titles, titleKind } from '../../schema/titles.ts';
import { readTmdbExport } from '../../lib/sources/tmdb-export.ts';
import { isMain } from '../../../scripts/lib/is-main.ts';
import { runBatches } from './lib/batch.ts';
import { runSync } from './lib/run.ts';
import type { SyncSources } from './lib/sources.ts';
import { stampSync } from './lib/stamp.ts';

const DAY_MS = 24 * 60 * 60 * 1000;

export interface PopularitySyncResult {
	/** Titles with a TMDB id that the sync could score. */
	titles: number;
	updated: number;
	/** Titles missing from the export, left as they were. */
	notInExport: number;
}

/**
 * Updates `titles.popularity` from TMDB's daily id exports (film and series). The exports are
 * streamed and read, never stored: only titles that already have a `tmdb_id` are written, and
 * only when the score changed. Today's export may not be out yet (it is ready by 08:00 UTC),
 * so the day before is used then. An export with no rows throws and nothing is written.
 */
export async function syncPopularity(
	db: Db,
	sources: Pick<SyncSources, 'tmdbExport'>,
	{ now = new Date(), log = console.log }: { now?: Date; log?: (line: string) => void } = {}
): Promise<PopularitySyncResult> {
	const stored = await db
		.select({
			id: titles.id,
			kind: titles.kind,
			tmdbId: titles.tmdbId,
			popularity: titles.popularity
		})
		.from(titles)
		.where(isNotNull(titles.tmdbId));
	const result: PopularitySyncResult = { titles: stored.length, updated: 0, notInExport: 0 };
	if (stored.length === 0) {
		log('Popularity: no title has a TMDB id yet, so there is nothing to score.');
		return result;
	}

	const byKey = new Map(stored.map((row) => [`${row.kind}:${row.tmdbId}`, row]));
	const changes: { id: string; popularity: number }[] = [];
	const seen = new Set<string>();
	for (const kind of titleKind) {
		let chunks = await sources.tmdbExport(kind, now);
		chunks ??= await sources.tmdbExport(kind, new Date(now.getTime() - DAY_MS));
		if (!chunks) throw new Error(`The TMDB ${kind} export is not published; nothing was changed.`);
		let read = 0;
		for await (const { id, popularity } of readTmdbExport(chunks)) {
			read++;
			const key = `${kind}:${id}`;
			const row = byKey.get(key);
			if (!row) continue;
			seen.add(key);
			if (row.popularity !== popularity) changes.push({ id: row.id, popularity });
		}
		if (read === 0) throw new Error(`The TMDB ${kind} export has no rows; nothing was changed.`);
	}

	const statements: BatchItem<'sqlite'>[] = changes.map(({ id, popularity }) =>
		db
			.update(titles)
			// A score refresh is not an edit of the title, so `updated_at` keeps its value.
			.set({ popularity, popularityAt: now, updatedAt: sql`${titles.updatedAt}` })
			.where(eq(titles.id, id))
	);
	await runBatches(db, statements);

	result.updated = changes.length;
	result.notInExport = stored.length - seen.size;
	await stampSync(db, 'popularity', result.updated, now);
	log(
		`Popularity: ${result.titles} titles with a TMDB id; ${result.updated} scores updated, ` +
			`${result.notInExport} not in the export.`
	);
	return result;
}

if (isMain(import.meta.url)) {
	await runSync(process.argv.slice(2), async (db, sources) => {
		await syncPopularity(db, sources);
	});
}
