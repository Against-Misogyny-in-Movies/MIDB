import { describe, it, expect } from 'vitest';
import { count, eq, lte } from 'drizzle-orm';
import { db } from '#lib/server/db.ts';
import { titles } from '#db/schema/titles.ts';
import { sourceSync, titleBechdel, titleUm, umSource } from '#db/schema/sources.ts';
import { syncUm } from '#db/scripts/sync/sync-um.ts';
import { syncBechdel } from '#db/scripts/sync/sync-bechdel.ts';
import { syncPopularity } from '#db/scripts/sync/sync-popularity.ts';
import { fixtureSources, type SyncSources } from '#db/scripts/sync/lib/sources.ts';
import { trackWrites, writes } from '../../test/writes.ts';

const NOW = new Date('2026-11-12T10:00:00Z');
const sources = fixtureSources();
const quiet = { now: NOW, log: () => {} };

type BechdelSources = Pick<SyncSources, 'bechdelRss' | 'bechdelYear'>;
type UmItem = Record<string, unknown> & { id: number };
const feed = async () => (await sources.umFeed()) as UmItem[];

async function tally() {
	const n = async (table: typeof titles | typeof titleBechdel | typeof umSource | typeof titleUm) =>
		(await db.select({ n: count() }).from(table))[0].n;
	return {
		titles: await n(titles),
		bechdel: await n(titleBechdel),
		um: await n(umSource),
		bindings: await n(titleUm)
	};
}

async function bindingsByTitle() {
	const rows = await db
		.select({ title: titles.title, umId: titleUm.umId })
		.from(titleUm)
		.innerJoin(titles, eq(titles.id, titleUm.titleId));
	return Object.fromEntries(rows.map((r) => [r.title, r.umId]));
}

async function stamp(source: 'um' | 'bechdel' | 'popularity') {
	const [row] = await db.select().from(sourceSync).where(eq(sourceSync.source, source));
	return row;
}

/** A year page in the site's markup, for films the fixtures do not have. */
function yearPage(
	year: number,
	films: { bechdelId: number; imdbId: string; title: string; rating: number }[]
) {
	const rows = films
		.map(
			(f) =>
				`<div class="movie"><a href="https://www.imdb.com/title/${f.imdbId}/"><img src="/static/pass.png" alt="[${f.rating}]" title="[x]"></a>\n  <a id="movie-${f.bechdelId}" href="/view/${f.bechdelId}/x/">${f.title}</a>\n</div>`
		)
		.join('');
	return `<h2 class="section-head">${year} <span class="year-count">(${films.length} movies)</span></h2>${rows}`;
}

/** The fixture sources with the 2020 page replaced by `edit`'s result. */
function with2020(edit: (html: string) => string): BechdelSources {
	return {
		bechdelRss: sources.bechdelRss,
		bechdelYear: async (year) =>
			year === 2020 ? edit((await sources.bechdelYear(2020))!) : sources.bechdelYear(year)
	};
}

async function loadAll() {
	await syncBechdel(db, sources, quiet);
	await syncUm(db, await sources.umFeed(), quiet);
}

describe('source sync (fixtures)', () => {
	it('loads the Bechdel films, then the UM catalogue, and binds matches by reference', async () => {
		const bechdel = await syncBechdel(db, sources, quiet);
		// A database that never synced sweeps every year: the fixtures hold 1874 and 2020.
		expect(bechdel).toMatchObject({
			full: true,
			films: 12,
			titlesInserted: 12,
			ratingsWritten: 12
		});
		expect(await tally()).toMatchObject({ titles: 12, bechdel: 12 });

		const um = await syncUm(db, await sources.umFeed(), quiet);
		expect(um).toMatchObject({
			feedRows: 21,
			inserted: 21,
			updated: 0,
			deleted: 0,
			matchedFilms: 14,
			bindings: 10,
			ambiguous: 0,
			noMatch: 5
		});
		expect(await tally()).toMatchObject({ um: 21, bindings: 10 });

		// With several UM items on one film, the highest id is bound.
		expect(await bindingsByTitle()).toMatchObject({ Ava: 6489, 'The Call': 14975, 'Emma.': 8551 });

		// A binding holds only (title_id, um_id); every flag is read from um_source.
		const [binding] = await db.select().from(titleUm).limit(1);
		expect(Object.keys(binding).sort()).toEqual(['createdAt', 'titleId', 'umId']);

		// No year is ever stored as 0.
		expect(await db.select({ n: count() }).from(titles).where(lte(titles.year, 0))).toEqual([
			{ n: 0 }
		]);
		expect(await db.select({ n: count() }).from(umSource).where(lte(umSource.year, 0))).toEqual([
			{ n: 0 }
		]);
	});

	it('stamps each source with its last success and the rows it changed', async () => {
		await loadAll();
		expect(await stamp('bechdel')).toEqual({
			source: 'bechdel',
			lastSuccessAt: NOW,
			rowsChanged: 24
		});
		expect(await stamp('um')).toEqual({ source: 'um', lastSuccessAt: NOW, rowsChanged: 31 });

		const later = new Date('2026-11-13T10:00:00Z');
		await syncUm(db, await sources.umFeed(), { now: later, log: () => {} });
		expect(await stamp('um')).toEqual({ source: 'um', lastSuccessAt: later, rowsChanged: 0 });
	});

	it('writes nothing on a second run over unchanged data', async () => {
		await loadAll();
		await trackWrites('titles', 'title_bechdel', 'um_source', 'title_um');

		const before = await writes();
		const bechdel = await syncBechdel(db, sources, { ...quiet, full: true });
		const um = await syncUm(db, await sources.umFeed(), quiet);
		expect(await writes()).toBe(before);
		expect(bechdel).toMatchObject({ titlesInserted: 0, titlesUpdated: 0, ratingsWritten: 0 });
		expect(um).toMatchObject({ inserted: 0, updated: 0, deleted: 0, bindingsWritten: 0 });
	});

	it('upserts only the UM rows the feed has updated since', async () => {
		await loadAll();
		await trackWrites('um_source', 'title_um');

		const items = await feed();
		const edited = items.map((i) =>
			i.id === 6561
				? { ...i, rapeOnScreen: true, updatedAt: new Date(NOW.getTime() + 1000).toISOString() }
				: i
		);
		const before = await writes();
		const um = await syncUm(db, edited, quiet);
		expect(um).toMatchObject({ inserted: 0, updated: 1, bindingsWritten: 0 });
		expect(await writes()).toBe(before + 1);
		const [row] = await db.select().from(umSource).where(eq(umSource.umId, 6561));
		expect(row.rapeOnScreen).toBe(true);

		// An updatedAt that is not newer than the stored one leaves the row alone.
		const older = items.map((i) => (i.id === 6561 ? { ...i, rapeOnScreen: false } : i));
		await syncUm(db, older, quiet);
		const [kept] = await db.select().from(umSource).where(eq(umSource.umId, 6561));
		expect(kept.rapeOnScreen).toBe(true);
	});

	it('deletes UM rows missing from the feed, removing their bindings first', async () => {
		await loadAll();
		expect(await bindingsByTitle()).toMatchObject({
			Ava: 6489,
			"I'm Thinking of Ending Things": 4642
		});

		// 6489 is Ava's binding and 4642 the only one of its film. Foreign keys are on, so
		// deleting a row before its binding would fail the sync.
		const rest = (await feed()).filter((i) => i.id !== 6489 && i.id !== 4642);
		const um = await syncUm(db, rest, quiet);
		expect(um).toMatchObject({ deleted: 2, inserted: 0 });
		expect(
			await db.select({ id: umSource.umId }).from(umSource).where(eq(umSource.umId, 6489))
		).toEqual([]);

		const bound = await bindingsByTitle();
		expect(bound.Ava).toBe(4433);
		expect(bound["I'm Thinking of Ending Things"]).toBeUndefined();
		expect(await tally()).toMatchObject({ um: 19, bindings: 9 });
	});

	it('binds a film added after the UM sync on the next run, and unbinds one that turns ambiguous', async () => {
		await loadAll();
		expect(await bindingsByTitle()).not.toHaveProperty('22 Jump Street');

		await db.insert(titles).values({
			kind: 'movie',
			imdbId: 'tt1',
			title: '22 Jump Street',
			cleanTitle: '22 jump street',
			year: 2014
		});
		const added = await syncUm(db, await sources.umFeed(), quiet);
		expect(added).toMatchObject({ inserted: 0, bindingsWritten: 1 });
		expect(await bindingsByTitle()).toMatchObject({ '22 Jump Street': 1449 });

		// A second film with the key makes it ambiguous: UM's year for the item is unknown.
		await db.insert(titles).values({
			kind: 'movie',
			imdbId: 'tt2',
			title: '22 Jump Street',
			cleanTitle: '22 jump street',
			year: 1990
		});
		const ambiguous = await syncUm(db, await sources.umFeed(), quiet);
		expect(ambiguous).toMatchObject({ ambiguous: 1, bindingsRemoved: 1 });
		expect(await bindingsByTitle()).not.toHaveProperty('22 Jump Street');
	});

	it('upserts a changed Bechdel title and a changed rating, leaving the rest', async () => {
		await syncBechdel(db, sources, quiet);
		await trackWrites('titles', 'title_bechdel');

		const renamed = with2020((html) =>
			html.replace('>12 Hour Shift<', '>12 Hour Shift (Extended)<')
		);
		const before = await writes();
		const first = await syncBechdel(db, renamed, { ...quiet, full: true });
		expect(first).toMatchObject({ titlesInserted: 0, titlesUpdated: 1, ratingsWritten: 0 });
		expect(await writes()).toBe(before + 1);
		const [row] = await db.select().from(titles).where(eq(titles.imdbId, 'tt10309552'));
		expect(row).toMatchObject({
			title: '12 Hour Shift (Extended)',
			cleanTitle: '12 hour shift extended'
		});

		// A Quiet Place Part II drops from 3 to 2.
		const rerated = with2020((html) =>
			html
				.replace('>12 Hour Shift<', '>12 Hour Shift (Extended)<')
				.replace(
					'tt8332922/"><img src="/static/pass.png" alt="[3]"',
					'tt8332922/"><img src="/static/pass.png" alt="[2]"'
				)
		);
		const second = await syncBechdel(db, rerated, { ...quiet, full: true });
		expect(second).toMatchObject({ titlesUpdated: 0, ratingsWritten: 1 });
		const [rating] = await db
			.select({ rating: titleBechdel.rating })
			.from(titleBechdel)
			.where(eq(titleBechdel.bechdelId, 9918));
		expect(rating.rating).toBe(2);
	});

	it('reads the recent years and the recent additions daily, after a first sweep', async () => {
		await syncBechdel(db, sources, quiet);
		const asked: number[] = [];
		const daily: BechdelSources = {
			bechdelRss: sources.bechdelRss,
			bechdelYear: async (year) => {
				asked.push(year);
				return year === 2026
					? yearPage(2026, [{ bechdelId: 12440, imdbId: 'tt9999999', title: 'Digger', rating: 1 }])
					: null;
			}
		};
		const result = await syncBechdel(db, daily, quiet);
		// The feed's years (1997, 2023, 2026) join the current year and the two before it.
		expect(asked).toEqual([1997, 2023, 2024, 2025, 2026]);
		expect(result).toMatchObject({ full: false, years: 5, films: 1, titlesInserted: 1 });
		expect(await tally()).toMatchObject({ titles: 13, bechdel: 13 });
	});

	it('scores titles from the TMDB exports and writes only changed scores', async () => {
		await syncBechdel(db, sources, quiet);
		await db.update(titles).set({ tmdbId: 603 }).where(eq(titles.imdbId, 'tt10309552'));
		await db.update(titles).set({ tmdbId: 999999 }).where(eq(titles.imdbId, 'tt8332922'));
		await db.insert(titles).values({
			kind: 'tv',
			tmdbId: 1396,
			title: 'Breaking Bad',
			cleanTitle: 'breaking bad'
		});
		const [before] = await db
			.select({ updatedAt: titles.updatedAt })
			.from(titles)
			.where(eq(titles.tmdbId, 603));

		const result = await syncPopularity(db, sources, quiet);
		expect(result).toEqual({ titles: 3, updated: 2, notInExport: 1 });
		const [movie] = await db.select().from(titles).where(eq(titles.tmdbId, 603));
		expect(movie).toMatchObject({
			popularity: 37.2943,
			popularityAt: NOW,
			updatedAt: before.updatedAt
		});
		const [tv] = await db.select().from(titles).where(eq(titles.tmdbId, 1396));
		expect(tv.popularity).toBe(162.648);
		const [missing] = await db.select().from(titles).where(eq(titles.tmdbId, 999999));
		expect(missing.popularity).toBeNull();
		expect(await stamp('popularity')).toEqual({
			source: 'popularity',
			lastSuccessAt: NOW,
			rowsChanged: 2
		});

		await trackWrites('titles');
		const written = await writes();
		expect(await syncPopularity(db, sources, quiet)).toMatchObject({ updated: 0 });
		expect(await writes()).toBe(written);
	});

	it('falls back to yesterday’s export when today’s is not out yet', async () => {
		await db
			.insert(titles)
			.values({ kind: 'movie', tmdbId: 603, title: 'The Matrix', cleanTitle: 'matrix' });
		const asked: string[] = [];
		const late: Pick<SyncSources, 'tmdbExport'> = {
			async tmdbExport(kind, date) {
				asked.push(`${kind} ${date.toISOString().slice(0, 10)}`);
				return date.getTime() === NOW.getTime() ? null : sources.tmdbExport(kind, date);
			}
		};
		await syncPopularity(db, late, quiet);
		expect(asked).toEqual([
			'movie 2026-11-12',
			'movie 2026-11-11',
			'tv 2026-11-12',
			'tv 2026-11-11'
		]);
		expect(await db.select({ p: titles.popularity }).from(titles)).toEqual([{ p: 37.2943 }]);
	});
});

describe('source sync failures change nothing', () => {
	it('a UM feed with no films or series fails and deletes nothing', async () => {
		await loadAll();
		const before = await tally();

		await expect(syncUm(db, [], quiet)).rejects.toThrow(/no films or series/);
		const books = (await feed()).filter((i) => i.itemType === 'book');
		await expect(syncUm(db, books, quiet)).rejects.toThrow(/no films or series/);
		await expect(syncUm(db, { not: 'a list' }, quiet)).rejects.toThrow(/not an array/);
		expect(await tally()).toEqual(before);
	});

	it('a changed feed shape fails before any write', async () => {
		const broken = (await feed()).map(({ rapeOnScreen: _dropped, ...rest }) => rest);
		await expect(syncUm(db, broken, quiet)).rejects.toThrow(/changed shape/);
		expect(await tally()).toMatchObject({ um: 0 });
		expect(await stamp('um')).toBeUndefined();
	});

	it('Bechdel pages that give no films fail without writing or stamping', async () => {
		await syncBechdel(db, sources, quiet);
		const before = await tally();
		const gone: BechdelSources = { bechdelRss: sources.bechdelRss, bechdelYear: async () => null };
		await expect(syncBechdel(db, gone, { ...quiet, full: true })).rejects.toThrow(/no films/);
		expect(await tally()).toEqual(before);
		expect((await stamp('bechdel')).rowsChanged).toBe(24);
	});

	it('a Bechdel page that does not match its own count fails the whole run', async () => {
		const broken = with2020((html) => html.replace('(11 movies)', '(12 movies)'));
		await expect(syncBechdel(db, broken, { ...quiet, full: true })).rejects.toThrow(
			/lists 12 films/
		);
		expect(await tally()).toMatchObject({ titles: 0 });
	});

	it('an empty or missing TMDB export fails and scores nothing', async () => {
		await db
			.insert(titles)
			.values({ kind: 'movie', tmdbId: 603, title: 'The Matrix', cleanTitle: 'matrix' });
		const empty: Pick<SyncSources, 'tmdbExport'> = {
			tmdbExport: async () => (async function* () {})()
		};
		await expect(syncPopularity(db, empty, quiet)).rejects.toThrow(/no rows/);
		const missing: Pick<SyncSources, 'tmdbExport'> = { tmdbExport: async () => null };
		await expect(syncPopularity(db, missing, quiet)).rejects.toThrow(/not published/);
		expect(await db.select({ p: titles.popularity }).from(titles)).toEqual([{ p: null }]);
		expect(await stamp('popularity')).toBeUndefined();
	});
});
