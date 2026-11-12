/**
 * Plain data shared by the comment schema (`db/schema/community.ts`, which imports it with a
 * relative path because the Node-run graph has no `#lib`), the endpoints and the comment UI.
 */

/** A comment body is 1 to this many characters (a CHECK in the schema, a limit in the endpoints). */
export const COMMENT_BODY_MAX = 5000;

/** A report's free-text note is at most this long. */
export const REPORT_NOTE_MAX = 500;

/** Where a comment is in its life. Only `published` is shown to everyone. */
export const commentStatus = ['pending', 'published', 'hidden', 'rejected', 'deleted'] as const;

/** What put a comment in its current moderation state. */
export const moderationSource = ['ai', 'blocklist', 'moderator', 'reports'] as const;

export const reportReason = [
	'hate',
	'harassment',
	'spam',
	'sexual-content',
	'threat',
	'other'
] as const;

export const reportStatus = ['open', 'resolved', 'dismissed'] as const;

/** What a moderator did, as written to `moderation_actions`. */
export const moderationAction = [
	'approve',
	'hide',
	'reject',
	'restore',
	'dismiss',
	'mute',
	'ban'
] as const;

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

/** A moderator's reason on a hide or a reject is at most this long (the classifier's reason limit). */
export const MODERATION_REASON_MAX = 140;

/** The mute lengths a moderator picks from, in hours. */
export const MUTE_HOURS = [24, 168, 720] as const;
