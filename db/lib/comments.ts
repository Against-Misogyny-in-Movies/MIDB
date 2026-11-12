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
	'ban'
] as const;

/** A moderator's reason on a hide or a reject is at most this long (the classifier's reason limit). */
export const MODERATION_REASON_MAX = 140;
