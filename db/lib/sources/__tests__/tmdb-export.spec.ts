import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { readTmdbExport, tmdbExportUrl, type TmdbPopularity } from '../tmdb-export.ts';

async function* chunked(bytes: Uint8Array, size: number) {
	for (let i = 0; i < bytes.length; i += size) yield bytes.slice(i, i + size);
}

async function collect(chunks: AsyncIterable<Uint8Array | string>): Promise<TmdbPopularity[]> {
	const rows: TmdbPopularity[] = [];
	for await (const row of readTmdbExport(chunks)) rows.push(row);
	return rows;
}

const movies = readFileSync('db/test/fixtures/tmdb-movie-ids.ndjson');

describe('readTmdbExport', () => {
	it('yields the id and popularity of each line, however the stream is split', () => {
		const whole = collect(chunked(movies, movies.length));
		// 5-byte chunks cut lines and multi-byte characters ("à") in the middle.
		const split = collect(chunked(movies, 5));
		return Promise.all([whole, split]).then(([a, b]) => {
			expect(a).toHaveLength(6);
			expect(a[0]).toEqual({ id: 3924, popularity: 1.092 });
			expect(a.at(-1)).toEqual({ id: 27205, popularity: 44.0181 });
			expect(b).toEqual(a);
		});
	});

	it('reads a last line with no newline and skips blank lines', async () => {
		const rows = await collect(
			chunked(new TextEncoder().encode('{"id":1,"popularity":2}\n\n{"id":3,"popularity":4}'), 4)
		);
		expect(rows).toEqual([
			{ id: 1, popularity: 2 },
			{ id: 3, popularity: 4 }
		]);
	});

	it('throws on a line that is not JSON or lacks a field', async () => {
		await expect(collect(chunked(new TextEncoder().encode('not json\n'), 64))).rejects.toThrow(
			/not JSON/
		);
		await expect(collect(chunked(new TextEncoder().encode('{"id":1}\n'), 64))).rejects.toThrow(
			/without an id and a popularity/
		);
	});
});

describe('tmdbExportUrl', () => {
	it('names the file after the UTC day', () => {
		const date = new Date('2026-11-02T23:30:00Z');
		expect(tmdbExportUrl('movie', date)).toBe(
			'https://files.tmdb.org/p/exports/movie_ids_11_02_2026.json.gz'
		);
		expect(tmdbExportUrl('tv', date)).toBe(
			'https://files.tmdb.org/p/exports/tv_series_ids_11_02_2026.json.gz'
		);
	});
});
