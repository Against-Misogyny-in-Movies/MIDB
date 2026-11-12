export type { GenderBreakdown } from '#lib/media/types/media.ts';

import type { MediaDetail } from '#lib/media/types/media.ts';

export interface Movie extends MediaDetail {
	tagline: string;
	runtime: number;
	budget: number;
	revenue: number;
}
