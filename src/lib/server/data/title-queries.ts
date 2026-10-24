import { and, eq, isNull, sql } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { titles } from '$db/schema/titles';
import { normalizeTitle } from '$db/scripts/lib/normalizeTitle';
import { isUniqueViolation } from './pg-errors';

export type TitleRow = typeof titles.$inferSelect;
export type TitleKind = TitleRow['kind'];

/** Minimal structural type that both Movie and Series satisfy. */
export interface TitleRef {
	title: string;
	imdbId: string | null;
	tmdbId: string;
	releaseDate: string;
}

function parseTmdbId(ref: TitleRef): number | null {
	const n = Number(ref.tmdbId);
	return Number.isInteger(n) && n > 0 ? n : null;
}

function parseYear(ref: TitleRef): number | null {
	const year = parseInt(ref.releaseDate.slice(0, 4), 10);
	return Number.isNaN(year) ? null : year;
}

/**
 * Read-only identity resolution: the `titles` row for this kind, matched on `(kind, tmdb_id)`
 * and then on `imdb_id`, or null if the title was never written. Use this on GET routes so a
 * page visit never mutates the DB; when it returns null the metric queries are skipped.
 */
export async function getTitleRow(kind: TitleKind, ref: TitleRef): Promise<TitleRow | null> {
	const tmdbId = parseTmdbId(ref);
	if (tmdbId !== null) {
		const byTmdb = await db.query.titles.findFirst({
			where: and(eq(titles.kind, kind), eq(titles.tmdbId, tmdbId))
		});
		if (byTmdb) return byTmdb;
	}

	if (ref.imdbId) {
		const byImdb = await db.query.titles.findFirst({
			where: and(eq(titles.kind, kind), eq(titles.imdbId, ref.imdbId))
		});
		if (byImdb) return byImdb;
	}

	return null;
}

/**
 * Write path for future write endpoints (community ratings, comments) that need a `titles.id`
 * FK target. Same lookup as getTitleRow, then a race-safe insert on a miss
 * (ON CONFLICT DO NOTHING, then read again), then a backfill of whichever id was missing.
 * Never call it from a GET route.
 */
export async function getOrCreateTitleRow(kind: TitleKind, ref: TitleRef): Promise<TitleRow> {
	const existing = await getTitleRow(kind, ref);
	if (existing) return backfillIds(existing, ref);

	const [inserted] = await db
		.insert(titles)
		.values({
			kind,
			tmdbId: parseTmdbId(ref),
			imdbId: ref.imdbId || null,
			title: ref.title,
			cleanTitle: normalizeTitle(ref.title),
			year: parseYear(ref)
		})
		.onConflictDoNothing()
		.returning();
	if (inserted) return inserted;

	const raced = await getTitleRow(kind, ref);
	if (!raced) throw new Error(`getOrCreateTitleRow: ${kind} ${ref.tmdbId} missing after conflict`);
	return backfillIds(raced, ref);
}

/**
 * Fill a null tmdb_id / imdb_id from the live ref (e.g. a Bechdel-seeded row with only an IMDb
 * id). Only null columns are written, and a value already held by another row is left alone.
 */
async function backfillIds(row: TitleRow, ref: TitleRef): Promise<TitleRow> {
	const tmdbId = row.tmdbId === null ? parseTmdbId(ref) : null;
	const imdbId = row.imdbId === null ? ref.imdbId || null : null;
	if (tmdbId === null && imdbId === null) return row;

	try {
		const [updated] = await db
			.update(titles)
			.set({
				...(tmdbId !== null && { tmdbId: sql`coalesce(${titles.tmdbId}, ${tmdbId})` }),
				...(imdbId !== null && { imdbId: sql`coalesce(${titles.imdbId}, ${imdbId})` })
			})
			.where(
				and(eq(titles.id, row.id), tmdbId !== null ? isNull(titles.tmdbId) : isNull(titles.imdbId))
			)
			.returning();
		return updated ?? row;
	} catch (e) {
		// Another row already owns that id; merging duplicates is not this function's job.
		if (isUniqueViolation(e)) return row;
		throw e;
	}
}
