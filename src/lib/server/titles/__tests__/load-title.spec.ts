import { beforeEach, describe, expect, test, vi } from 'vitest';
import type { UmEntry } from '$lib/media/types/um';

const mocks = vi.hoisted(() => ({
	getMovie: vi.fn(),
	getSeries: vi.fn(),
	getTitleRow: vi.fn(),
	getOrCreateTitleRow: vi.fn(),
	getBechdel: vi.fn(),
	getUmEntry: vi.fn(),
	getUnconsentingCandidates: vi.fn(),
	getTriggerTagsLive: vi.fn(),
	getTriggerTagsForSeries: vi.fn()
}));

vi.mock('$lib/server/integrations/tmdb', () => ({
	getMovie: mocks.getMovie,
	getSeries: mocks.getSeries
}));
vi.mock('$lib/server/integrations/ddd', () => ({
	getTriggerTagsLive: mocks.getTriggerTagsLive,
	getTriggerTagsForSeries: mocks.getTriggerTagsForSeries
}));
vi.mock('$lib/server/data/title-queries', () => ({
	getTitleRow: mocks.getTitleRow,
	getOrCreateTitleRow: mocks.getOrCreateTitleRow
}));
vi.mock('$lib/server/data/sources', () => ({
	getBechdel: mocks.getBechdel,
	getUmEntry: mocks.getUmEntry
}));
vi.mock('$lib/server/data/um-candidates', () => ({
	getUnconsentingCandidates: mocks.getUnconsentingCandidates
}));

import { loadTitle } from '$lib/server/titles/load-title';

const movie = { id: '603', tmdbId: '603', title: 'The Matrix', imdbId: 'tt0133093' };
const series = { id: '1399', tmdbId: '1399', title: 'Game of Thrones', imdbId: 'tt0944947' };
const row = { id: 'title-uuid' };
const entry = { umId: 1, cleanName: 'matrix' } as UmEntry;
const bechdel = { titleId: 'title-uuid', rating: 3 };

beforeEach(() => {
	for (const fn of Object.values(mocks)) fn.mockReset();
	mocks.getMovie.mockResolvedValue(movie);
	mocks.getSeries.mockResolvedValue(series);
	mocks.getBechdel.mockResolvedValue(bechdel);
	mocks.getUmEntry.mockResolvedValue(null);
	mocks.getUnconsentingCandidates.mockResolvedValue([]);
	// Never settles: proves the load returns without awaiting DDD.
	mocks.getTriggerTagsLive.mockReturnValue(new Promise(() => {}));
	mocks.getTriggerTagsForSeries.mockReturnValue(new Promise(() => {}));
});

describe('loadTitle', () => {
	test('movie with a seeded row: Bechdel + UM binding, no candidates, DDD streamed by imdb id', async () => {
		mocks.getTitleRow.mockResolvedValue(row);
		mocks.getUmEntry.mockResolvedValue(entry);

		const data = await loadTitle('movie', '603');

		expect(mocks.getMovie).toHaveBeenCalledWith('603');
		expect(mocks.getTitleRow).toHaveBeenCalledWith('movie', movie);
		expect(data).toMatchObject({ media: movie, bechdel, umEntry: entry, umCandidates: [] });
		expect(mocks.getUnconsentingCandidates).not.toHaveBeenCalled();
		expect(mocks.getTriggerTagsLive).toHaveBeenCalledWith('tt0133093');
		expect(data.triggerTags).toBeInstanceOf(Promise);
	});

	test('movie without a binding falls back to UM candidates', async () => {
		mocks.getTitleRow.mockResolvedValue(row);
		mocks.getUnconsentingCandidates.mockResolvedValue([entry]);

		const data = await loadTitle('movie', '603');

		expect(mocks.getUnconsentingCandidates).toHaveBeenCalledWith(movie);
		expect(data).toMatchObject({ umEntry: null, umCandidates: [entry] });
	});

	test('unknown title: no source reads, candidates by title', async () => {
		mocks.getTitleRow.mockResolvedValue(null);

		const data = await loadTitle('movie', '603');

		expect(mocks.getBechdel).not.toHaveBeenCalled();
		expect(mocks.getUmEntry).not.toHaveBeenCalled();
		expect(data).toMatchObject({ bechdel: null, umEntry: null });
		expect(mocks.getUnconsentingCandidates).toHaveBeenCalledWith(movie);
	});

	test('series: never reads Bechdel, streams DDD by series', async () => {
		mocks.getTitleRow.mockResolvedValue(row);

		const data = await loadTitle('tv', '1399');

		expect(mocks.getSeries).toHaveBeenCalledWith('1399');
		expect(mocks.getTitleRow).toHaveBeenCalledWith('tv', series);
		expect(mocks.getBechdel).not.toHaveBeenCalled();
		expect(mocks.getUmEntry).toHaveBeenCalledWith('title-uuid');
		expect(data.bechdel).toBeNull();
		expect(mocks.getTriggerTagsForSeries).toHaveBeenCalledWith(series);
		expect(mocks.getTriggerTagsLive).not.toHaveBeenCalled();
	});

	test('is read-only: never takes the write path', async () => {
		mocks.getTitleRow.mockResolvedValue(null);
		await loadTitle('movie', '603');
		await loadTitle('tv', '1399');
		expect(mocks.getOrCreateTitleRow).not.toHaveBeenCalled();
	});
});
