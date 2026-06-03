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
}

export interface DddResult {
	/** DDD media item id, used to deep-link to the movie's page. Null when not found. */
	itemId: number | null;
	tags: TriggerTag[];
}

interface CacheEntry {
	data: DddResult;
	expiresAt: number;
}

const cache = new Map<string, CacheEntry>();

interface DddSearchResult {
	id: number;
}

interface DddTopicStat {
	topicItemId: number;
	// DDD returns these PascalCased.
	TopicId: number;
	doesName: string;
	yesSum: number;
	noSum: number;
	comment: string | null;
}

interface DddMediaItem {
	topicItemStats: DddTopicStat[];
}

const EMPTY: DddResult = { itemId: null, tags: [] };

export async function getTriggerTagsLive(imdbId: string | null): Promise<DddResult> {
	if (!imdbId) return EMPTY;

	const cached = cache.get(imdbId);
	if (cached && Date.now() < cached.expiresAt) {
		return cached.data;
	}

	const headers = {
		'X-API-KEY': DDD_API_KEY,
		Accept: 'application/json',
	};

	// Step 1: look up by imdb id
	const searchRes = await fetch(`${DDD_BASE}/dddsearch?imdb=${encodeURIComponent(imdbId)}`, { headers });
	if (!searchRes.ok) return EMPTY;

	const searchData = await searchRes.json();
	const items: DddSearchResult[] = searchData?.items ?? [];
	if (!Array.isArray(items) || items.length === 0) return EMPTY;

	const itemId = items[0]?.id;
	if (!itemId) return EMPTY;

	// Step 2: fetch media item details
	const mediaRes = await fetch(`${DDD_BASE}/media/${itemId}`, { headers });
	if (!mediaRes.ok) return { itemId, tags: [] };

	const mediaData: DddMediaItem = await mediaRes.json();
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
		}));

	const result: DddResult = { itemId, tags };
	cache.set(imdbId, { data: result, expiresAt: Date.now() + CACHE_TTL_MS });
	return result;
}

export function _testExports() {
	return { cache, CACHE_TTL_MS };
}
