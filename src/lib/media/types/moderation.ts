import type { VERDICT_CATEGORIES } from '#lib/media/utils/comments.ts';

/** What the moderation page shows, defined with its queries and re-exported here as types only. */
export type { ModerationItem, RecentAction } from '#lib/server/data/moderation-queue.ts';

export type {
	FlaggedTitle,
	HeldReport,
	OpenTitle,
	ReportAccount,
	ReportAnswerColumns,
	TitleReport
} from '#lib/server/data/community-report-queue.ts';

export type {
	AiLabel,
	ModerationTable,
	ModerationTableRow
} from '#lib/server/data/moderation-table.ts';
export type VerdictCategory = (typeof VERDICT_CATEGORIES)[number];
