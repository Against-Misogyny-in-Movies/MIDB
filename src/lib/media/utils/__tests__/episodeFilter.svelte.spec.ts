import { afterEach, describe, expect, test } from 'vitest';
import { flushSync } from 'svelte';
import type { DddResult, TriggerTag } from '$lib/media/types/ddd';
import { EpisodeFilter, filterTagsByEpisode } from '$lib/media/utils/episodeFilter.svelte.js';

function tag(topicItemId: number, season: number | null, episode: number | null): TriggerTag {
	return {
		topicItemId,
		topicId: topicItemId,
		doesName: `topic ${topicItemId}`,
		yesSum: 1,
		noSum: 0,
		comment: null,
		category: null,
		season,
		episode
	};
}

// series-level, unscoped, S1, S1E2, S1E3, S2E1
const TAGS = [
	tag(1, -1, null),
	tag(2, null, null),
	tag(3, 1, null),
	tag(4, 1, 2),
	tag(5, 1, 3),
	tag(6, 2, 1)
];
const ids = (tags: TriggerTag[]) => tags.map((t) => t.topicItemId);

describe('filterTagsByEpisode', () => {
	test('no season: series-level and unscoped tags', () => {
		expect(ids(filterTagsByEpisode(TAGS, null, null))).toEqual([1, 2]);
	});

	test('season only: that season (any episode) plus series-level', () => {
		expect(ids(filterTagsByEpisode(TAGS, 1, null))).toEqual([1, 3, 4, 5]);
		expect(ids(filterTagsByEpisode(TAGS, 2, null))).toEqual([1, 6]);
	});

	test('season and episode: that episode plus series-level', () => {
		expect(ids(filterTagsByEpisode(TAGS, 1, 2))).toEqual([1, 4]);
		expect(ids(filterTagsByEpisode(TAGS, 3, 1))).toEqual([1]);
	});
});

describe('EpisodeFilter', () => {
	let cleanup: (() => void) | null = null;
	afterEach(() => {
		cleanup?.();
		cleanup = null;
	});

	function mount(ddd: DddResult | null) {
		const state = $state({ ddd, titleId: 'a' });
		let filter!: EpisodeFilter;
		cleanup = $effect.root(() => {
			filter = new EpisodeFilter(
				() => state.ddd,
				() => state.titleId
			);
		});
		return { filter, state };
	}

	test('no tags while DDD is pending', () => {
		const { filter } = mount(null);
		expect(filter.visibleTags).toEqual([]);
	});

	test('starts unselected and filters on select', () => {
		const { filter } = mount({ itemId: 1, tags: TAGS, isSeries: true });
		expect(filter.season).toBeNull();
		expect(filter.episode).toBeNull();
		expect(ids(filter.visibleTags)).toEqual([1, 2]);

		filter.select(1, 3);
		flushSync();
		expect(filter.season).toBe(1);
		expect(filter.episode).toBe(3);
		expect(ids(filter.visibleTags)).toEqual([1, 5]);
	});

	test('the selection resets when the title changes', () => {
		const { filter, state } = mount({ itemId: 1, tags: TAGS, isSeries: true });
		filter.select(2, 1);
		flushSync();
		expect(ids(filter.visibleTags)).toEqual([1, 6]);

		state.titleId = 'b';
		flushSync();
		expect(filter.season).toBeNull();
		expect(filter.episode).toBeNull();
		expect(ids(filter.visibleTags)).toEqual([1, 2]);
	});
});
