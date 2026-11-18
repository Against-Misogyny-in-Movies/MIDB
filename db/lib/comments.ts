/**
 * Plain data the comment schema (`db/schema/community.ts`) and the app share: the enum tuples
 * and the length limits behind its CHECK constraints. It lives in `db/lib/` because the
 * Node-run graph cannot import from `src/`; the app reaches it through
 * `#lib/media/utils/comments.ts`.
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
	'ban',
	'approve_report',
	'reject_report',
	'reject_account_reports',
	'resolve_count_flag',
	'dismiss_count_flag',
	'unmute',
	'unban',
	'reopen_flag',
	'set_role',
	'note'
] as const;

/**
 * The rules a moderator names when they hide, reject, mute or ban: the report reasons, the
 * classifier's extra categories and `other`. Stored with the comment (`comments.moderation_rule`)
 * and the logged action (`moderation_actions.rule`); the AI and blocklist paths leave it null.
 */
export const moderationRule = [
	'hate',
	'harassment',
	'threat',
	'sexual-content',
	'spam',
	'violence',
	'disparagement',
	'trolling',
	'other'
] as const;

/** A staff note on an account is 1 to this many characters. */
export const NOTE_MAX = 1000;

/** A moderator's reason on a hide or a reject is at most this long (the classifier's reason limit). */
export const MODERATION_REASON_MAX = 140;

/** The concern a moderator types for an AI scan is at most this many characters. */
export const SCAN_CONCERN_MAX = 200;
