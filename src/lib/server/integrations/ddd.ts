import { env } from '#lib/server/env.ts';
import { getCached } from '#lib/server/cache/index.ts';
import type { TriggerTag, DddResult } from './ddd-types';

export type { TriggerTag, DddResult } from './ddd-types';

const DDD_BASE = 'https://www.doesthedogdie.com';
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour
// A non-OK upstream answer is kept briefly: long enough to spare DDD a retry storm, short
// enough that an outage does not hide a title's warnings for an hour.
const FAILED_TTL_MS = 60 * 1000;

/** A lookup's result, and whether DDD answered with a non-OK status on the way. */
interface Lookup {
	result: DddResult;
	failed: boolean;
}

const ttlFor = (lookup: Lookup) => (lookup.failed ? FAILED_TTL_MS : CACHE_TTL_MS);

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

/** Request headers; the key is read per call because the Worker's env belongs to the request. */
function dddHeaders() {
	return { 'X-API-KEY': env.DDD_API_KEY ?? '', Accept: 'application/json' };
}

async function fetchMediaTags(
	itemId: number
): Promise<{ tags: TriggerTag[]; isSeries: boolean; failed: boolean }> {
	const mediaRes = await fetch(`${DDD_BASE}/media/${itemId}`, { headers: dddHeaders() });
	if (!mediaRes.ok) return { tags: [], isSeries: false, failed: true };

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

	return { tags, isSeries, failed: false };
}

/**
 * Fetches trigger-warning tags for a movie from doesthedogdie.com, keyed by IMDb id.
 * Results are cached for `CACHE_TTL_MS` (1 hour), and a non-OK upstream answer for 60 seconds, to avoid hammering the API.
 * Only tags where `yesSum >= noSum && yesSum > 0` are returned (community says "yes").
 *
 * @param imdbId - The IMDb id string (e.g. `"tt0052080"`), or `null` if unknown.
 * @returns A `DddResult` with the DDD item id and filtered tag list, or an empty result if not found.
 */
export async function getTriggerTagsLive(imdbId: string | null): Promise<DddResult> {
	if (!imdbId) return EMPTY;

	const { result } = await getCached<Lookup>(`ddd:imdb:${imdbId}`, ttlFor, async () => {
		// Step 1: look up by imdb id
		const searchRes = await fetch(`${DDD_BASE}/dddsearch?imdb=${encodeURIComponent(imdbId)}`, {
			headers: dddHeaders()
		});
		if (!searchRes.ok) return { result: EMPTY, failed: true };

		const searchData = (await searchRes.json()) as { items?: DddSearchItem[] } | null;
		const items: DddSearchItem[] = searchData?.items ?? [];
		if (!Array.isArray(items) || items.length === 0) return { result: EMPTY, failed: false };

		const itemId = items[0]?.id;
		if (!itemId) return { result: EMPTY, failed: false };

		// Step 2: fetch media item details
		const { tags, isSeries, failed } = await fetchMediaTags(itemId);
		return { result: { itemId, tags, isSeries }, failed };
	});
	return result;
}

/**
 * Fetches trigger-warning tags for a TV series from doesthedogdie.com.
 * IMDb lookup is unreliable for series, so this searches by title text, then matches
 * by TMDB id (preferred) or first-air year (fallback). Results are cached as `getTriggerTagsLive` does.
 *
 * @param series - Object with `title`, `tmdbId`, and `firstAirDate` (YYYY-MM-DD or empty).
 * @returns A `DddResult` with `isSeries: true`, the matched item id, and filtered tags.
 */
export async function getTriggerTagsForSeries(series: {
	title: string;
	tmdbId: string;
	firstAirDate: string;
}): Promise<DddResult> {
	const { result } = await getCached<Lookup>(`ddd:tmdb:${series.tmdbId}`, ttlFor, async () => {
		const empty: DddResult = { ...EMPTY, isSeries: true };
		// Text-search by title (imdb= lookup fails for TV series)
		const searchRes = await fetch(`${DDD_BASE}/dddsearch?q=${encodeURIComponent(series.title)}`, {
			headers: dddHeaders()
		});
		if (!searchRes.ok) return { result: empty, failed: true };

		const searchData = (await searchRes.json()) as { items?: DddSearchItem[] } | null;
		const items: DddSearchItem[] = searchData?.items ?? [];
		if (!Array.isArray(items) || items.length === 0) return { result: empty, failed: false };

		// Filter to TV shows (itemType.id === 16), then match by tmdbid, fall back to releaseYear
		const tvItems = items.filter((it) => it.itemType?.id === 16);
		const tmdbIdNum = Number(series.tmdbId);
		const firstAirYear = series.firstAirDate ? parseInt(series.firstAirDate.slice(0, 4), 10) : NaN;

		const match =
			tvItems.find((it) => it.tmdbid === tmdbIdNum) ??
			(!Number.isNaN(firstAirYear)
				? tvItems.find((it) => it.releaseYear === firstAirYear)
				: undefined);

		if (!match) return { result: empty, failed: false };

		const { tags, failed } = await fetchMediaTags(match.id);
		return { result: { itemId: match.id, tags, isSeries: true }, failed };
	});
	return result;
}
