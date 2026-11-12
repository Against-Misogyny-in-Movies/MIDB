// @vitest-environment node
import { afterEach, describe, it, expect, vi } from 'vitest';
import { readTmdbExport } from '../../../../lib/sources/tmdb-export.ts';
import { liveSources } from '../sources.ts';

const DAY = new Date('2026-11-12T10:00:00Z');

async function gzip(text: string): Promise<Blob> {
	const stream = new Blob([text]).stream().pipeThrough(new CompressionStream('gzip'));
	return new Response(stream).blob();
}

afterEach(() => vi.unstubAllGlobals());

describe('liveSources().tmdbExport', () => {
	it('decompresses the gzipped export into readable lines', async () => {
		const body = await gzip('{"id":603,"popularity":40.5}\n{"id":1396,"popularity":12}\n');
		const fetchMock = vi.fn(async () => new Response(body));
		vi.stubGlobal('fetch', fetchMock);

		const chunks = await liveSources().tmdbExport('movie', DAY);
		expect(chunks).not.toBeNull();
		const rows: unknown[] = [];
		for await (const row of readTmdbExport(chunks!)) rows.push(row);
		expect(rows).toEqual([
			{ id: 603, popularity: 40.5 },
			{ id: 1396, popularity: 12 }
		]);
		expect((fetchMock.mock.calls[0] as unknown as [string])[0]).toBe(
			'https://files.tmdb.org/p/exports/movie_ids_11_12_2026.json.gz'
		);
	});

	it('returns null when the export is not published yet', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn(async () => new Response('', { status: 404 }))
		);
		expect(await liveSources().tmdbExport('movie', DAY)).toBeNull();
	});
});
