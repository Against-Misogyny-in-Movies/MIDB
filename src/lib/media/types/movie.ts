export type { UmCandidate } from '$lib/media/utils/metrics';
export type { GenderBreakdown } from '$lib/media/types/media';

import type { MediaDetail } from '$lib/media/types/media';

export interface Movie extends MediaDetail {
	tagline: string;
	runtime: number;
	budget: number;
	revenue: number;
}
