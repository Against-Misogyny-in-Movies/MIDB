import type { MediaDetail } from '$lib/movie/media';

export type { UmCandidate } from '$lib/movie/metrics.js';
export type { GenderBreakdown } from '$lib/movie/media';

export interface Series extends MediaDetail {
	firstAirDate: string;
	lastAirDate: string;
	numberOfSeasons: number;
	numberOfEpisodes: number;
	episodeRunTime: number[];
	seasons: {
		seasonNumber: number;
		episodeCount: number;
		name: string;
		airDate: string;
	}[];
	networks: { id: number; name: string }[];
	createdBy: { id: number; name: string }[];
}
