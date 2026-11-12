/**
 * Plain data for the comment endpoints and UI. The enum tuples and length limits that the
 * schema's CHECKs also use live in `db/lib/comments.ts` and are re-exported here.
 */

import type { reportReason, commentStatus } from '#db/lib/comments.ts';

export {
	COMMENT_BODY_MAX,
	MODERATION_REASON_MAX,
	REPORT_NOTE_MAX,
	commentStatus,
	moderationAction,
	moderationSource,
	reportReason,
	reportStatus
} from '#db/lib/comments.ts';

/** Distinct open reports that move a published comment back to review. */
export const REPORT_THRESHOLD = 3;

/** The reason names a reader picks from, in the order the report form lists them. */
export const REPORT_REASON_LABELS: Record<(typeof reportReason)[number], string> = {
	hate: 'Hate or bigotry',
	harassment: 'Harassment',
	spam: 'Spam',
	'sexual-content': 'Sexual content',
	threat: 'Threat',
	other: 'Other'
};

/** What a comment's status reads as to its author. */
export const COMMENT_STATUS_LABELS: Record<(typeof commentStatus)[number], string> = {
	pending: 'Awaiting review',
	published: 'Published',
	hidden: 'Hidden',
	rejected: 'Rejected',
	deleted: 'Deleted'
};

/** The mute lengths a moderator picks from, in hours. */
export const MUTE_HOURS = [24, 168, 720] as const;
