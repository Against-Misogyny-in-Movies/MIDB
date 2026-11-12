/**
 * Plain data the reader-report schema (`db/schema/community.ts`) and the app share: the enum
 * tuples behind its CHECK constraints. It lives in `db/lib/` because the Node-run graph cannot
 * import from `src/`; the app reaches it through `#lib/media/utils/readerReports.ts`.
 */

/** What a report says about one of the four violence categories. NULL means not sure. */
export const reportLevel = ['none', 'mentioned', 'on_screen'] as const;

/** What a report says about sexual objectification. NULL means not sure. */
export const objectificationLevel = ['none', 'some_scenes', 'throughout'] as const;

/** How the title treats the violence. NULL means not answered. */
export const reportFraming = [
	'condemned',
	'unclear',
	'played_for_laughs',
	'glamorised_or_justified'
] as const;

/** Whether a report counts: `held` waits for a moderator, `rejected` never counts. */
export const contentReportStatus = ['counted', 'held', 'rejected'] as const;

/** Why a report is held. */
export const holdReason = ['contradicts_source', 'burst', 'busy_new_account'] as const;
