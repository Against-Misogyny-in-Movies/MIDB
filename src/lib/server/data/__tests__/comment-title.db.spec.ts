import { describe, it, expect, vi, beforeEach } from 'vitest';
import { db } from '#lib/server/db.ts';
import { titles } from '#db/schema/titles.ts';
import { readerReportsTag } from '#lib/server/http/cache.ts';

const getMovie = vi.fn();
const getSeries = vi.fn();
vi.mock('#lib/server/integrations/tmdb/index.ts', () => ({ getMovie, getSeries }));

const { parseTitleParams, resolveWriteRef, resolveCommentTitle } =
	await import('../comment-title.ts');

const tmdbMovie = { title: 'Alien', imdbId: 'tt0078748', tmdbId: '348', releaseDate: '1979-05-25' };

beforeEach(() => {
	getMovie.mockReset();
	getSeries.mockReset();
	getMovie.mockResolvedValue(tmdbMovie);
	getSeries.mockResolvedValue({ ...tmdbMovie, title: 'Dark', tmdbId: '70523' });
});

describe('parseTitleParams', () => {
	it('normalises a padded id so a cache tag and its purge name the same title', () => {
		const padded = parseTitleParams('movie', '0348');
		const plain = parseTitleParams('movie', '348');
		expect(padded).toEqual({ kind: 'movie', tmdbId: '348' });
		expect(readerReportsTag(padded.kind, padded.tmdbId)).toBe(
			readerReportsTag(plain.kind, plain.tmdbId)
		);
	});

	it('answers 404 for an unknown kind or a non-numeric id', () => {
		for (const [kind, id] of [
			['person', '1'],
			['movie', 'abc'],
			['movie', '']
		])
			expect(() => parseTitleParams(kind, id)).toThrow();
	});
});

describe('resolveWriteRef', () => {
	it('uses the existing row and does not call TMDB', async () => {
		await db
			.insert(titles)
			.values({ kind: 'movie', title: 'Alien', cleanTitle: 'alien', tmdbId: 348, imdbId: 'tt1' });
		expect(await resolveWriteRef('movie', '348')).toEqual({
			title: 'Alien',
			imdbId: 'tt1',
			tmdbId: '348',
			releaseDate: ''
		});
		expect(getMovie).not.toHaveBeenCalled();
	});

	it('takes TMDB data for a title with no row, and creates no row', async () => {
		expect(await resolveWriteRef('movie', '348')).toEqual(tmdbMovie);
		expect(getMovie).toHaveBeenCalledWith('348');
		expect(await resolveWriteRef('tv', '70523')).toMatchObject({ title: 'Dark' });
		expect(getSeries).toHaveBeenCalledWith('70523');
		expect(await db.select().from(titles)).toEqual([]);
	});
});

describe('resolveCommentTitle', () => {
	it('creates the row from TMDB on the first write, then reuses it', async () => {
		const first = await resolveCommentTitle('movie', '348');
		expect(first).toMatchObject({ kind: 'movie', tmdbId: 348, title: 'Alien' });
		const second = await resolveCommentTitle('movie', '348');
		expect(second.id).toBe(first.id);
		expect(getMovie).toHaveBeenCalledTimes(1);
	});
});
