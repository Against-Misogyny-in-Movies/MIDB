import type { DddResult, TriggerTag } from '$lib/media/types/ddd';

/**
 * DDD tags for a season/episode selection. Series-level tags (season -1) always show; with no
 * season picked, unscoped tags (season null) show too.
 */
export function filterTagsByEpisode(
	tags: TriggerTag[],
	season: number | null,
	episode: number | null
): TriggerTag[] {
	if (season === null) return tags.filter((t) => t.season === -1 || t.season === null);
	if (episode === null) return tags.filter((t) => t.season === season || t.season === -1);
	return tags.filter((t) => (t.season === season && t.episode === episode) || t.season === -1);
}

/** The TV page's season/episode selection over the streamed DDD result. */
export class EpisodeFilter {
	#ddd: () => DddResult | null;
	#titleId: () => string;

	// Writable deriveds: a pick overrides them until the title changes, which resets both.
	season = $derived.by((): number | null => {
		void this.#titleId(); // track
		return null;
	});
	episode = $derived.by((): number | null => {
		void this.#titleId(); // track
		return null;
	});

	visibleTags = $derived.by(() => {
		const ddd = this.#ddd();
		return ddd ? filterTagsByEpisode(ddd.tags, this.season, this.episode) : [];
	});

	/**
	 * @param ddd - Getter for the streamed DDD result (null while pending).
	 * @param titleId - Getter for the current title's id; the selection resets when it changes.
	 */
	constructor(ddd: () => DddResult | null, titleId: () => string) {
		this.#ddd = ddd;
		this.#titleId = titleId;
	}

	select(season: number | null, episode: number | null) {
		this.season = season;
		this.episode = episode;
	}
}
