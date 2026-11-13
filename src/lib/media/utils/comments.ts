/**
 * Plain data for the comment endpoints and UI. The enum tuples and length limits that the
 * schema's CHECKs also use live in `db/lib/comments.ts` and are re-exported here. The moderation
 * categories are app data, so they live here.
 */

import type { reportReason, commentStatus } from '#db/lib/comments.ts';
import type { CommentStatus } from '#lib/media/types/comments.ts';

export {
	COMMENT_BODY_MAX,
	MODERATION_REASON_MAX,
	REPORT_NOTE_MAX,
	SCAN_CONCERN_MAX,
	commentStatus,
	moderationAction,
	moderationSource,
	reportReason,
	reportStatus
} from '#db/lib/comments.ts';

/** What the classifier may flag a comment for. */
export const VERDICT_CATEGORIES = [
	'hate',
	'misogyny',
	'harassment',
	'slur',
	'threat',
	'sexual-minors',
	'sexual-explicit',
	'doxxing',
	'spam',
	'survivor-mockery',
	'off-topic',
	'violence',
	'disparagement',
	'trolling'
] as const;

/** What each category means, for the prompts that name them. */
export const CATEGORY_MEANINGS: Record<(typeof VERDICT_CATEGORIES)[number], string> = {
	hate: 'hate speech against a group',
	misogyny: 'endorsing or celebrating misogyny or sexual violence',
	harassment: 'attacking, insulting or harassing a person',
	slur: 'a slur',
	threat: 'a threat of harm',
	'sexual-minors': 'sexual content involving minors',
	'sexual-explicit': 'explicit sexual content',
	doxxing: 'sharing personal information',
	spam: 'spam, advertising or unrelated links',
	'survivor-mockery': 'mocking or doubting survivors',
	'off-topic': 'unrelated to the title',
	violence: 'glorifying or calling for violence',
	disparagement: 'demeaning a person or a group without a slur',
	trolling: 'bad-faith bait meant to provoke'
};

/** A plain-language table query is at most this many characters. */
export const AI_QUERY_MAX = 300;

/** An AI scan sends this many comments per model call. */
export const SCAN_BATCH = 25;

/** An AI scan makes at most this many calls, so it covers one page of the table. */
export const SCAN_MAX_BATCHES = 2;

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
