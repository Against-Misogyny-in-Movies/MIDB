import {
	NOT_SURE,
	OBJECTIFICATION_LEVEL_LABELS,
	REPORT_CATEGORIES,
	REPORT_LEVEL_LABELS,
	objectificationLevel,
	reportLevel,
	sexualLevel,
	SEXUAL_LEVEL_LABELS,
	type ReportCategory
} from '#lib/media/utils/communityReports.ts';
import type { ReportCounts } from '#lib/media/types/community-reports.ts';

export type Figure = { label: string; n: number };

/** Each level set's levels, most serious first (the tuples run from the least serious), with the labels the form uses. */
const ORDER = {
	sexual: sexualLevel.toReversed().map((l) => [l, SEXUAL_LEVEL_LABELS[l]] as const),
	violence: reportLevel.toReversed().map((l) => [l, REPORT_LEVEL_LABELS[l]] as const),
	objectification: objectificationLevel
		.toReversed()
		.map((l) => [l, OBJECTIFICATION_LEVEL_LABELS[l]] as const)
};

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
