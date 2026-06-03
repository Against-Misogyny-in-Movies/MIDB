import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock SvelteKit env before importing the module
vi.mock('$env/static/private', () => ({ DDD_API_KEY: 'test-key' }));

// We test the logic directly without the cache module boundary
// by inlining the filter logic here

interface DddTopicStat {
	topicId: number;
	doesName: string;
	yesSum: number;
	noSum: number;
	mediaItemComment: string | null;
}

function filterTriggerTags(stats: DddTopicStat[]) {
	return stats
		.filter((s) => s.yesSum >= s.noSum && s.yesSum > 0)
		.map((s) => ({
			topicId: s.topicId,
			doesName: s.doesName,
			yesSum: s.yesSum,
			noSum: s.noSum,
			comment: s.mediaItemComment ?? null,
		}));
}

const OLD_YELLER_STATS: DddTopicStat[] = [
	{ topicId: 1, doesName: 'Does the dog die', yesSum: 950, noSum: 10, mediaItemComment: 'The dog is shot.' },
	{ topicId: 2, doesName: 'Is there animal cruelty', yesSum: 400, noSum: 50, mediaItemComment: null },
	{ topicId: 3, doesName: 'Is there a happy ending', yesSum: 20, noSum: 800, mediaItemComment: null },
	{ topicId: 4, doesName: 'Does a child die', yesSum: 0, noSum: 500, mediaItemComment: null },
];

describe('DDD filter logic', () => {
	it('includes topics where yesSum >= noSum and yesSum > 0', () => {
		const result = filterTriggerTags(OLD_YELLER_STATS);
		expect(result.map((r) => r.topicId)).toEqual([1, 2]);
	});

	it('excludes topics where noSum > yesSum', () => {
		const result = filterTriggerTags(OLD_YELLER_STATS);
		expect(result.find((r) => r.topicId === 3)).toBeUndefined();
	});

	it('excludes topics where yesSum is 0', () => {
		const result = filterTriggerTags(OLD_YELLER_STATS);
		expect(result.find((r) => r.topicId === 4)).toBeUndefined();
	});

	it('preserves doesName and comment', () => {
		const result = filterTriggerTags(OLD_YELLER_STATS);
		expect(result[0].doesName).toBe('Does the dog die');
		expect(result[0].comment).toBe('The dog is shot.');
		expect(result[1].comment).toBeNull();
	});

	it('returns empty array for empty stats', () => {
		expect(filterTriggerTags([])).toEqual([]);
	});

	it('returns empty when all topics have yesSum < noSum', () => {
		const stats: DddTopicStat[] = [
			{ topicId: 1, doesName: 'Does X happen', yesSum: 5, noSum: 100, mediaItemComment: null },
		];
		expect(filterTriggerTags(stats)).toEqual([]);
	});
});

describe('getTriggerTagsLive', () => {
	beforeEach(() => {
		vi.resetAllMocks();
	});

	it('returns empty result for null imdbId', async () => {
		const { getTriggerTagsLive } = await import('./ddd.server.js');
		const result = await getTriggerTagsLive(null);
		expect(result).toEqual({ itemId: null, tags: [] });
	});

	it('returns cached result on second call without re-fetching', async () => {
		const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
			ok: true,
			json: async () => ({ items: [{ id: 42 }] }),
		} as Response);

		vi.spyOn(globalThis, 'fetch')
			.mockResolvedValueOnce({
				ok: true,
				json: async () => ({ items: [{ id: 42 }] }),
			} as Response)
			.mockResolvedValueOnce({
				ok: true,
				json: async () => ({
					topicItemStats: [
						{ topicId: 1, doesName: 'Does the dog die', yesSum: 100, noSum: 5, mediaItemComment: null },
					],
				}),
			} as Response);

		const { getTriggerTagsLive, _testExports } = await import('./ddd.server.js');
		const { cache } = _testExports();
		cache.clear();

		const first = await getTriggerTagsLive('tt0052080');
		expect(first.itemId).toBe(42);
		expect(first.tags).toHaveLength(1);
		expect(fetchSpy).toHaveBeenCalledTimes(2); // search + media

		// Second call — should hit cache, no new fetch
		const second = await getTriggerTagsLive('tt0052080');
		expect(second).toEqual(first);
		expect(fetchSpy).toHaveBeenCalledTimes(2); // still 2, no new fetch
	});

	it('returns empty result when DDD search returns no items', async () => {
		vi.spyOn(globalThis, 'fetch').mockResolvedValue({
			ok: true,
			json: async () => ({ items: [] }),
		} as Response);

		const { getTriggerTagsLive, _testExports } = await import('./ddd.server.js');
		_testExports().cache.clear();

		const result = await getTriggerTagsLive('tt9999999');
		expect(result).toEqual({ itemId: null, tags: [] });
	});
});
