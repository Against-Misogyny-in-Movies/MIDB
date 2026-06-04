export type { UmCandidate } from '$lib/movie/metrics.js';
export type { GenderBreakdown } from '$lib/movie/media';

import type { MediaDetail } from '$lib/movie/media';

export interface Movie extends MediaDetail {
	tagline: string;
	runtime: number;
	budget: number;
	revenue: number;
}
