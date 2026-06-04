import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('$env/static/private', () => ({ DDD_API_KEY: 'test-key' }));

// ── Shared mock helpers ────────────────────────────────────────────────────

function mockSearchResponse(items: object[]) {
	return { ok: true, json: async () => ({ items }) } as Response;
}

function mockMediaResponse(stats: object[], itemType?: object) {
	return {
		ok: true,
		json: async () => ({
			item: itemType ? { itemType } : undefined,
			topicItemStats: stats
		})
	} as Response;
}

// ── getTriggerTagsLive ────────────────────────────────────────────────────

describe('getTriggerTagsLive', () => {
	beforeEach(() => vi.resetAllMocks());

	it('returns EMPTY for null imdbId', async () => {
		const { getTriggerTagsLive } = await import('./ddd.server.js');
		const result = await getTriggerTagsLive(null);
		expect(result).toEqual({ itemId: null, tags: [], isSeries: false });
	});

	it('maps TopicId, index1→season, index2→episode correctly', async () => {
		vi.spyOn(globalThis, 'fetch')
			.mockResolvedValueOnce(mockSearchResponse([{ id: 42 }]))
			.mockResolvedValueOnce(
				mockMediaResponse([
					{
						topicItemId: 1,
						TopicId: 10,
						doesName: 'Dog dies',
						yesSum: 100,
						noSum: 5,
						comment: 'Yes',
						index1: null,
						index2: null
					},
					{
						topicItemId: 2,
						TopicId: 11,
						doesName: 'Violence',
						yesSum: 50,
						noSum: 3,
						comment: null,
						index1: 2,
						index2: 4
					}
				])
			);

		const { getTriggerTagsLive, _testExports } = await import('./ddd.server.js');
		_testExports().cache.clear();

		const result = await getTriggerTagsLive('tt0052080');
		expect(result.itemId).toBe(42);
		expect(result.tags).toHaveLength(2);
		expect(result.tags[0]).toMatchObject({
			topicItemId: 1,
			topicId: 10,
			season: null,
			episode: null
		});
		expect(result.tags[1]).toMatchObject({ topicItemId: 2, topicId: 11, season: 2, episode: 4 });
	});

	it('drops rows where yesSum < noSum', async () => {
		vi.spyOn(globalThis, 'fetch')
			.mockResolvedValueOnce(mockSearchResponse([{ id: 99 }]))
			.mockResolvedValueOnce(
				mockMediaResponse([
					{
						topicItemId: 1,
						TopicId: 1,
						doesName: 'Dog dies',
						yesSum: 10,
						noSum: 5,
						comment: null,
						index1: null,
						index2: null
					},
					{
						topicItemId: 2,
						TopicId: 2,
						doesName: 'Happy ending',
						yesSum: 5,
						noSum: 100,
						comment: null,
						index1: null,
						index2: null
					}
				])
			);

		const { getTriggerTagsLive, _testExports } = await import('./ddd.server.js');
		_testExports().cache.clear();

		const result = await getTriggerTagsLive('tt1111111');
		expect(result.tags).toHaveLength(1);
		expect(result.tags[0].topicId).toBe(1);
	});

	it('returns empty result when DDD search returns no items', async () => {
		vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(mockSearchResponse([]));

		const { getTriggerTagsLive, _testExports } = await import('./ddd.server.js');
		_testExports().cache.clear();

		const result = await getTriggerTagsLive('tt9999999');
		expect(result).toEqual({ itemId: null, tags: [], isSeries: false });
	});

	it('cache key is prefixed imdb: and second call skips fetch', async () => {
		const fetchSpy = vi
			.spyOn(globalThis, 'fetch')
			.mockResolvedValueOnce(mockSearchResponse([{ id: 42 }]))
			.mockResolvedValueOnce(
				mockMediaResponse([
					{
						topicItemId: 1,
						TopicId: 1,
						doesName: 'Dog dies',
						yesSum: 10,
						noSum: 1,
						comment: null,
						index1: null,
						index2: null
					}
				])
			);

		const { getTriggerTagsLive, _testExports } = await import('./ddd.server.js');
		_testExports().cache.clear();

		const first = await getTriggerTagsLive('tt0052080');
		const second = await getTriggerTagsLive('tt0052080');

		expect(second).toEqual(first);
		expect(fetchSpy).toHaveBeenCalledTimes(2); // search + media, not 4
	});
});

// ── getTriggerTagsForSeries ───────────────────────────────────────────────

describe('getTriggerTagsForSeries', () => {
	beforeEach(() => vi.resetAllMocks());

	it('selects TV item by tmdbid match (itemType.id === 16)', async () => {
		vi.spyOn(globalThis, 'fetch')
			.mockResolvedValueOnce(
				mockSearchResponse([
					{ id: 10, tmdbid: 9999, itemType: { id: 15 }, releaseYear: 2011 }, // movie — skip
					{ id: 678166, tmdbid: 1399, itemType: { id: 16 }, releaseYear: 2011 } // TV — match
				])
			)
			.mockResolvedValueOnce(
				mockMediaResponse(
					[
						{
							topicItemId: 5,
							TopicId: 20,
							doesName: 'Dragons',
							yesSum: 200,
							noSum: 10,
							comment: null,
							index1: 1,
							index2: 1
						}
					],
					{ index1: 'season' }
				)
			);

		const { getTriggerTagsForSeries, _testExports } = await import('./ddd.server.js');
		_testExports().cache.clear();

		const result = await getTriggerTagsForSeries({
			title: 'Game of Thrones',
			tmdbId: '1399',
			firstAirDate: '2011-04-17'
		});

		expect(result.itemId).toBe(678166);
		expect(result.isSeries).toBe(true);
		expect(result.tags[0]).toMatchObject({ topicItemId: 5, season: 1, episode: 1 });
	});

	it('falls back to releaseYear when no tmdbid match', async () => {
		vi.spyOn(globalThis, 'fetch')
			.mockResolvedValueOnce(
				mockSearchResponse([
					{ id: 500, tmdbid: 9000, itemType: { id: 16 }, releaseYear: 2008 } // wrong tmdb, right year
				])
			)
			.mockResolvedValueOnce(mockMediaResponse([]));

		const { getTriggerTagsForSeries, _testExports } = await import('./ddd.server.js');
		_testExports().cache.clear();

		const result = await getTriggerTagsForSeries({
			title: 'Breaking Bad',
			tmdbId: '1396',
			firstAirDate: '2008-01-20'
		});

		expect(result.itemId).toBe(500);
	});

	it('returns EMPTY with isSeries:true when no match found', async () => {
		vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(mockSearchResponse([]));

		const { getTriggerTagsForSeries, _testExports } = await import('./ddd.server.js');
		_testExports().cache.clear();

		const result = await getTriggerTagsForSeries({
			title: 'Unknown Show',
			tmdbId: '99999',
			firstAirDate: '2020-01-01'
		});

		expect(result).toEqual({ itemId: null, tags: [], isSeries: true });
	});

	it('cache key is prefixed tmdb: and second call skips fetch', async () => {
		const fetchSpy = vi
			.spyOn(globalThis, 'fetch')
			.mockResolvedValueOnce(
				mockSearchResponse([{ id: 678166, tmdbid: 1399, itemType: { id: 16 }, releaseYear: 2011 }])
			)
			.mockResolvedValueOnce(mockMediaResponse([]));

		const { getTriggerTagsForSeries, _testExports } = await import('./ddd.server.js');
		_testExports().cache.clear();

		const series = { title: 'Game of Thrones', tmdbId: '1399', firstAirDate: '2011-04-17' };
		const first = await getTriggerTagsForSeries(series);
		const second = await getTriggerTagsForSeries(series);

		expect(second).toEqual(first);
		expect(fetchSpy).toHaveBeenCalledTimes(2);
	});
});
