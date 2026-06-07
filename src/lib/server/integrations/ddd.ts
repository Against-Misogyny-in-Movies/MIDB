import { DDD_API_KEY } from '$env/static/private';
import { getCached, clearCache } from '$lib/server/cache';
import type { TriggerTag, DddResult } from './ddd-types';

export type { TriggerTag, DddResult } from './ddd-types';

const DDD_BASE = 'https://www.doesthedogdie.com';
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

interface DddSearchItem {
	id: number;
	name?: string;
	releaseYear?: number;
	tmdbid?: number;
	itemType?: { id: number; index1?: string };
}

interface DddTopicStat {
	topicItemId: number;
	// DDD returns these PascalCased.
	TopicId: number;
	doesName: string;
	yesSum: number;
	noSum: number;
	comment: string | null;
	TopicCategory?: { name: string } | null;
	index1?: number | null;
	index2?: number | null;
}

interface DddMediaItem {
	topicItemStats: DddTopicStat[];
	item?: { itemType?: { index1?: string } };
}

const EMPTY: DddResult = { itemId: null, tags: [], isSeries: false };

const headers = {
	'X-API-KEY': DDD_API_KEY,
	Accept: 'application/json'
};

async function fetchMediaTags(itemId: number): Promise<{ tags: TriggerTag[]; isSeries: boolean }> {
	const mediaRes = await fetch(`${DDD_BASE}/media/${itemId}`, { headers });
	if (!mediaRes.ok) return { tags: [], isSeries: false };

	const mediaData: DddMediaItem = await mediaRes.json();
	const isSeries = mediaData.item?.itemType?.index1 === 'season';
	const stats: DddTopicStat[] = mediaData?.topicItemStats ?? [];

	const tags: TriggerTag[] = stats
		.filter((s) => s.yesSum >= s.noSum && s.yesSum > 0)
		.map((s) => ({
			topicItemId: s.topicItemId,
			topicId: s.TopicId,
			doesName: s.doesName,
			yesSum: s.yesSum,
			noSum: s.noSum,
			comment: s.comment ?? null,
			category: s.TopicCategory?.name ?? null,
			season: s.index1 ?? null,
			episode: s.index2 ?? null
		}));

	return { tags, isSeries };
}

/**
 * Fetches trigger-warning tags for a movie from doesthedogdie.com, keyed by IMDb id.
 * Results are cached in-process for `CACHE_TTL_MS` (1 hour) to avoid hammering the API.
 * Only tags where `yesSum >= noSum && yesSum > 0` are returned (community says "yes").
 *
 * @param imdbId - The IMDb id string (e.g. `"tt0052080"`), or `null` if unknown.
 * @returns A `DddResult` with the DDD item id and filtered tag list, or an empty result if not found.
 */
export async function getTriggerTagsLive(imdbId: string | null): Promise<DddResult> {
	if (!imdbId) return EMPTY;

	return getCached(`ddd:imdb:${imdbId}`, CACHE_TTL_MS, async () => {
		// Step 1: look up by imdb id
		const searchRes = await fetch(`${DDD_BASE}/dddsearch?imdb=${encodeURIComponent(imdbId)}`, {
			headers
		});
		if (!searchRes.ok) return EMPTY;

		const searchData = await searchRes.json();
		const items: DddSearchItem[] = searchData?.items ?? [];
		if (!Array.isArray(items) || items.length === 0) return EMPTY;

		const itemId = items[0]?.id;
		if (!itemId) return EMPTY;

		// Step 2: fetch media item details
		const { tags, isSeries } = await fetchMediaTags(itemId);
		return { itemId, tags, isSeries };
	});
}

/**
 * Fetches trigger-warning tags for a TV series from doesthedogdie.com.
 * IMDb lookup is unreliable for series, so this searches by title text, then matches
 * by TMDB id (preferred) or first-air year (fallback). Results are cached for 1 hour.
 *
 * @param series - Object with `title`, `tmdbId`, and `firstAirDate` (YYYY-MM-DD or empty).
 * @returns A `DddResult` with `isSeries: true`, the matched item id, and filtered tags.
 */
export async function getTriggerTagsForSeries(series: {
	title: string;
	tmdbId: string;
	firstAirDate: string;
}): Promise<DddResult> {
	return getCached(`ddd:tmdb:${series.tmdbId}`, CACHE_TTL_MS, async () => {
		// Text-search by title (imdb= lookup fails for TV series)
		const searchRes = await fetch(`${DDD_BASE}/dddsearch?q=${encodeURIComponent(series.title)}`, {
			headers
		});
		if (!searchRes.ok) return { ...EMPTY, isSeries: true };

		const searchData = await searchRes.json();
		const items: DddSearchItem[] = searchData?.items ?? [];
		if (!Array.isArray(items) || items.length === 0) return { ...EMPTY, isSeries: true };

		// Filter to TV shows (itemType.id === 16), then match by tmdbid, fall back to releaseYear
		const tvItems = items.filter((it) => it.itemType?.id === 16);
		const tmdbIdNum = Number(series.tmdbId);
		const firstAirYear = series.firstAirDate ? parseInt(series.firstAirDate.slice(0, 4), 10) : NaN;

		const match =
			tvItems.find((it) => it.tmdbid === tmdbIdNum) ??
			(!Number.isNaN(firstAirYear)
				? tvItems.find((it) => it.releaseYear === firstAirYear)
				: undefined);

		if (!match) return { ...EMPTY, isSeries: true };

		const { tags, isSeries } = await fetchMediaTags(match.id);
		return { itemId: match.id, tags, isSeries: isSeries || true };
	});
}

/**
 * Exposes internal module state for unit tests only.
 * Allows tests to clear the shared cache between test cases.
 *
 * @returns A `cache` handle with a synchronous `clear()` and the TTL constant.
 */
export function _testExports() {
	return { cache: { clear: () => void clearCache() }, CACHE_TTL_MS };
}
