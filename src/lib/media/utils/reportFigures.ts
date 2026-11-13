import {
	NOT_SURE,
	OBJECTIFICATION_LEVEL_LABELS,
	REPORT_CATEGORIES,
	REPORT_LEVEL_LABELS,
	SEXUAL_LEVEL_LABELS,
	type ReportCategory
} from '#lib/media/utils/readerReports.ts';
import type { ReportCounts } from '#lib/media/types/reader-reports.ts';

export type Figure = { label: string; n: number };

/** Each level set's levels, most serious first, with the labels the form uses. */
const ORDER = {
	sexual: [
		['present', SEXUAL_LEVEL_LABELS.present],
		['none', SEXUAL_LEVEL_LABELS.none]
	],
	violence: [
		['on_screen', REPORT_LEVEL_LABELS.on_screen],
		['mentioned', REPORT_LEVEL_LABELS.mentioned],
		['none', REPORT_LEVEL_LABELS.none]
	],
	objectification: [
		['throughout', OBJECTIFICATION_LEVEL_LABELS.throughout],
		['some_scenes', OBJECTIFICATION_LEVEL_LABELS.some_scenes],
		['none', OBJECTIFICATION_LEVEL_LABELS.none]
	]
} as const;

/** One category's answers as figures, most serious level first; a level nobody chose is left out. */
export function categoryFigures(counts: ReportCounts, key: ReportCategory): Figure[] {
	const category = REPORT_CATEGORIES.find((c) => c.key === key);
	if (!category) return [];
	const row: Record<string, number | undefined> = counts.categories[key];
	const figures: Figure[] = ORDER[category.levels].map(([level, label]) => ({
		label,
		n: row[level] ?? 0
	}));
	figures.push({ label: NOT_SURE, n: row.unsure ?? 0 });
	return figures.filter((f) => f.n > 0);
}
