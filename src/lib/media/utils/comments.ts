/**
 * Plain data for the comment endpoints and UI. The enum tuples and length limits that the
 * schema's CHECKs also use live in `db/lib/comments.ts` and are re-exported here.
 */

import type { reportReason, commentStatus } from '#db/lib/comments.ts';
import type { CommentStatus } from '#lib/media/types/comments.ts';

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

/** A mute length as the moderator reads it: "1 day" or "7 days". */
export const formatMuteHours = (hours: number): string =>
	hours === 24 ? '1 day' : `${hours / 24} days`;

/**
 * What the author reads under a comment that is not public: for a rejected one the reason
 * first, then who can see it.
 */
export function unpublishedNote(status: 'pending' | 'rejected', reason: string | null): string {
	if (status === 'pending') {
		return 'Only the author and moderators see the comment until a moderator decides.';
	}
	const text = reason?.trim();
	const lead = text ? `${/[.!?]$/.test(text) ? text : `${text}.`} ` : '';
	return `Rejected: ${lead}Only the author and moderators see the comment.`;
}

/**
 * The toast for a comment the reader posted or edited, from the status the server answered: a
 * success when it is public, a warning that says who sees it while it waits or was rejected.
 */
export function commentResult(
	action: 'post' | 'edit',
	comment: { status: CommentStatus; moderationReason: string | null }
): { tone: 'success' | 'warn'; text: string } {
	if (comment.status === 'rejected') {
		return { tone: 'warn', text: unpublishedNote('rejected', comment.moderationReason) };
	}
	if (comment.status === 'pending') {
		const lead = action === 'post' ? 'Comment sent.' : 'Comment saved.';
		return { tone: 'warn', text: `${lead} ${unpublishedNote('pending', null)}` };
	}
	return { tone: 'success', text: action === 'post' ? 'Comment posted.' : 'Comment saved.' };
}
