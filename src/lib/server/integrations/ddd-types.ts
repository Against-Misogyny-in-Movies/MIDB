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
