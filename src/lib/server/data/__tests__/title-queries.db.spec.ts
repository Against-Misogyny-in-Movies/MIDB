import { describe, it, expect } from 'vitest';
import { sql } from 'drizzle-orm';
import { titles } from '$db/schema/titles';
import { db } from '$lib/server/db';
import { getOrCreateTitleRow, getTitleRow, type TitleRef } from '$lib/server/data/title-queries';

const GOT: TitleRef = {
	title: 'Game of Thrones',
	imdbId: 'tt0944947',
	tmdbId: '1399',
	releaseDate: '2011-04-17'
};

async function insertTitle(values: Partial<typeof titles.$inferInsert> = {}) {
	const [row] = await db
		.insert(titles)
		.values({ kind: 'movie', title: 'Alien', cleanTitle: 'alien', year: 1979, ...values })
		.returning();
	return row;
}

async function count(): Promise<number> {
	const rows = await db.execute<{ n: number }>(sql`SELECT count(*)::int AS n FROM ${titles}`);
	return rows[0].n;
}

/** Concatenated xmin of every row: changes if any row is written. */
async function xmins(): Promise<string> {
	const rows = await db.execute<{ x: string | null }>(
		sql`SELECT string_agg(xmin::text, ',' ORDER BY id) AS x FROM ${titles}`
	);
	return rows[0].x ?? '';
}

describe('titles spine (review 2.4)', () => {
	it('lets a movie and a TV title share a TMDB id', async () => {
		await insertTitle({ kind: 'movie', tmdbId: 1399, title: 'Movie 1399' });
		await insertTitle({ kind: 'tv', tmdbId: 1399, title: 'Game of Thrones' });
		expect(await count()).toBe(2);
	});

	it('inserts a second TV title without a sentinel collision', async () => {
		const a = await getOrCreateTitleRow('tv', GOT);
		const b = await getOrCreateTitleRow('tv', {
			title: 'Breaking Bad',
			imdbId: null,
			tmdbId: '1396',
			releaseDate: '2008-01-20'
		});
		expect(a.id).not.toBe(b.id);
		expect(b).toMatchObject({ kind: 'tv', tmdbId: 1396, imdbId: null, year: 2008 });
	});

	it('rejects a duplicate (kind, tmdb_id)', async () => {
		await insertTitle({ kind: 'tv', tmdbId: 1399 });
		await expect(insertTitle({ kind: 'tv', tmdbId: 1399 })).rejects.toThrow();
	});
});

describe('getTitleRow', () => {
	it('prefers the (kind, tmdb_id) match over the imdb match', async () => {
		const byTmdb = await insertTitle({ kind: 'tv', tmdbId: 1399, imdbId: null });
		await insertTitle({ kind: 'tv', tmdbId: null, imdbId: GOT.imdbId });
		expect((await getTitleRow('tv', GOT))?.id).toBe(byTmdb.id);
	});

	it('falls back to imdb_id when no row has the TMDB id', async () => {
		const seeded = await insertTitle({ imdbId: 'tt0078748', tmdbId: null });
		const row = await getTitleRow('movie', {
			title: 'Alien',
			imdbId: 'tt0078748',
			tmdbId: '348',
			releaseDate: '1979-05-25'
		});
		expect(row?.id).toBe(seeded.id);
		expect(row?.tmdbId).toBeNull();
	});

	it('does not match a row of the other kind', async () => {
		await insertTitle({ kind: 'movie', tmdbId: 1399 });
		expect(await getTitleRow('tv', { ...GOT, imdbId: null })).toBeNull();
	});

	it('never writes (row count and xmin unchanged)', async () => {
		await insertTitle({ imdbId: 'tt0078748', tmdbId: null });
		const [n, x] = [await count(), await xmins()];
		await getTitleRow('movie', {
			title: 'Alien',
			imdbId: 'tt0078748',
			tmdbId: '348',
			releaseDate: '1979-05-25'
		});
		await getTitleRow('tv', GOT);
		expect(await count()).toBe(n);
		expect(await xmins()).toBe(x);
	});
});

describe('getOrCreateTitleRow', () => {
	it('backfills a missing tmdb_id on an imdb-only row', async () => {
		const seeded = await insertTitle({ imdbId: 'tt0078748', tmdbId: null });
		const row = await getOrCreateTitleRow('movie', {
			title: 'Alien',
			imdbId: 'tt0078748',
			tmdbId: '348',
			releaseDate: '1979-05-25'
		});
		expect(row).toMatchObject({ id: seeded.id, tmdbId: 348, imdbId: 'tt0078748' });
		expect(await count()).toBe(1);
	});

	it('backfills a missing imdb_id on a tmdb-only row', async () => {
		const created = await insertTitle({ kind: 'tv', tmdbId: 1399, imdbId: null });
		const row = await getOrCreateTitleRow('tv', GOT);
		expect(row).toMatchObject({ id: created.id, imdbId: GOT.imdbId });
	});

	it('creates a row with a null year when the release date is unknown', async () => {
		const row = await getOrCreateTitleRow('movie', {
			title: 'Untitled',
			imdbId: null,
			tmdbId: '999001',
			releaseDate: ''
		});
		expect(row).toMatchObject({ kind: 'movie', tmdbId: 999001, imdbId: null, year: null });
	});

	it('resolves two concurrent calls to a single row', async () => {
		const [a, b] = await Promise.all([
			getOrCreateTitleRow('tv', GOT),
			getOrCreateTitleRow('tv', GOT)
		]);
		expect(a.id).toBe(b.id);
		expect(await count()).toBe(1);
	});
});
