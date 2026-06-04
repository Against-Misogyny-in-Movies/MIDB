import { DDD_API_KEY } from '$env/static/private';

const DDD_BASE = 'https://www.doesthedogdie.com';
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

export interface TriggerTag {
	/** Per-media topic row id — unique within a media item, used as the {#each} key. */
	topicItemId: number;
	topicId: number;
	doesName: string;
	yesSum: number;
	noSum: number;
	comment: string | null;
	category: string | null;
	/** index1: -1 = series-level, null = unscoped, positive = season number */
	season: number | null;
	/** index2: episode number, null = unscoped */
	episode: number | null;
}

export interface DddResult {
	/** DDD media item id, used to deep-link to the movie/series page. Null when not found. */
	itemId: number | null;
	tags: TriggerTag[];
	isSeries: boolean;
}

interface CacheEntry {
	data: DddResult;
	expiresAt: number;
}

const cache = new Map<string, CacheEntry>();

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

export async function getTriggerTagsLive(imdbId: string | null): Promise<DddResult> {
	if (!imdbId) return EMPTY;

	const cacheKey = `imdb:${imdbId}`;
	const cached = cache.get(cacheKey);
	if (cached && Date.now() < cached.expiresAt) {
		return cached.data;
	}

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
	const result: DddResult = { itemId, tags, isSeries };
	cache.set(cacheKey, { data: result, expiresAt: Date.now() + CACHE_TTL_MS });
	return result;
}

export async function getTriggerTagsForSeries(series: {
	title: string;
	tmdbId: string;
	firstAirDate: string;
}): Promise<DddResult> {
	const cacheKey = `tmdb:${series.tmdbId}`;
	const cached = cache.get(cacheKey);
	if (cached && Date.now() < cached.expiresAt) {
		return cached.data;
	}

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
	const result: DddResult = { itemId: match.id, tags, isSeries: isSeries || true };
	cache.set(cacheKey, { data: result, expiresAt: Date.now() + CACHE_TTL_MS });
	return result;
}

export function _testExports() {
	return { cache, CACHE_TTL_MS };
}
