/**
 * Plain data for the comment endpoints and UI. The enum tuples and length limits that the
 * schema's CHECKs also use live in `db/lib/comments.ts` and are re-exported here. The moderation
 * categories are app data, so they live here.
 */

import type {
	moderationRule,
	reportReason,
	commentStatus,
	moderationSource
} from '#db/lib/comments.ts';
import type { CommentStatus, ModerationRule } from '#lib/media/types/comments.ts';

export {
	COMMENT_BODY_MAX,
	MODERATION_REASON_MAX,
	NOTE_MAX,
	REPORT_NOTE_MAX,
	SCAN_CONCERN_MAX,
	commentStatus,
	moderationAction,
	moderationRule,
	moderationSource,
	reportReason,
	reportStatus
} from '#db/lib/comments.ts';

/**
 * A `reject` verdict at or above this severity rejects the comment, and the moderation queue
 * starts a comment at or above it collapsed (`severity` runs 0 to 3).
 */
export const REJECT_MIN_SEVERITY = 2;

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

/** What each category is called in the moderation table and its filters. */
export const CATEGORY_LABELS: Record<(typeof VERDICT_CATEGORIES)[number], string> = {
	hate: 'Hate',
	misogyny: 'Misogyny',
	harassment: 'Harassment',
	slur: 'Slur',
	threat: 'Threat',
	'sexual-minors': 'Sexual content, minors',
	'sexual-explicit': 'Explicit sexual content',
	doxxing: 'Doxxing',
	spam: 'Spam',
	'survivor-mockery': 'Survivor mockery',
	'off-topic': 'Off topic',
	violence: 'Violence',
	disparagement: 'Disparagement',
	trolling: 'Trolling'
};

/** A category's label; a category this build does not know (an older verdict) reads as stored. */
export const categoryLabel = (category: string): string =>
	CATEGORY_LABELS[category as (typeof VERDICT_CATEGORIES)[number]] ?? category;

/** What put a comment in review, as the moderation table's source filter names it. */
export const MODERATION_SOURCE_LABELS: Record<(typeof moderationSource)[number], string> = {
	ai: 'Automatic check',
	blocklist: 'Blocklist',
	moderator: 'Moderator',
	reports: 'Reports'
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

/**
 * The rules a moderator names when they hide, reject, mute or ban, as the plates and the author
 * read them; the "Comment rules" section of `/resources` lists the same rules.
 */
export const MODERATION_RULE_LABELS: Record<(typeof moderationRule)[number], string> = {
	hate: 'Hate or bigotry',
	harassment: 'Harassment',
	threat: 'Threat',
	'sexual-content': 'Sexual content',
	spam: 'Spam',
	violence: 'Violence',
	disparagement: 'Disparagement',
	trolling: 'Trolling',
	other: 'Other'
};

/** What each rule covers, as the "Comment rules" section of `/resources` states it. */
export const MODERATION_RULE_MEANINGS: Record<(typeof moderationRule)[number], string> = {
	hate: 'Hate speech or bigotry against a group.',
	harassment: 'Attacking, insulting or harassing a person.',
	threat: 'A threat of harm.',
	'sexual-content': 'Explicit sexual content, or sexual content involving minors.',
	spam: 'Spam, advertising or links with no relation to the title.',
	violence: 'Glorifying or calling for violence.',
	disparagement: 'Demeaning a person or a group without a slur.',
	trolling: 'Bad-faith bait meant to provoke.',
	other: "A harm that no other rule names. The moderator's note says what."
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

/** A sentence's end: the text with a full stop unless it already ends one. */
const sentence = (text: string): string => (/[.!?]$/.test(text) ? text : `${text}.`);

/**
 * What a moderator told the author about a decision, as sentences: the rule's label, then the
 * moderator's note. Empty when neither was given (an automatic decision keeps its own reason in
 * the note).
 */
function decisionLead(reason: string | null, rule: ModerationRule | null): string {
	const note = reason?.trim();
	return [rule ? sentence(MODERATION_RULE_LABELS[rule]) : null, note ? sentence(note) : null]
		.filter((part) => part !== null)
		.join(' ');
}

/**
 * What the author reads under a comment that is not public. A rejected comment leads with the
 * rule and the note, then says who can see it.
 */
export function unpublishedNote(
	status: Exclude<(typeof commentStatus)[number], 'published'>,
	reason: string | null,
	rule: ModerationRule | null = null
): string {
	if (status === 'pending') {
		return 'Only the author and moderators see the comment until a moderator decides.';
	}
	if (status === 'hidden') {
		return 'A moderator hid this comment. Only the author and moderators see it.';
	}
	if (status === 'deleted') {
		return 'The author deleted this comment. Only the author and moderators see it.';
	}
	const lead = decisionLead(reason, rule);
	return `Rejected: ${lead ? `${lead} ` : ''}Only the author and moderators see the comment.`;
}

/** What the author reads in their comment history under a comment a moderator hid. */
export function hiddenNote(reason: string | null, rule: ModerationRule | null): string {
	const ruled = rule ? ` ${sentence(MODERATION_RULE_LABELS[rule])}` : '';
	return `A moderator hid this comment.${ruled}${reason ? ` Reason: ${reason}` : ''}`;
}

/**
 * The toast for a comment the reader posted or edited, from the status the server answered: a
 * success when it is public, a warning that says who sees it while it waits or was rejected.
 */
export function commentResult(
	action: 'post' | 'edit',
	comment: {
		status: CommentStatus;
		moderationReason: string | null;
		moderationRule?: ModerationRule | null;
	}
): { tone: 'success' | 'warn'; text: string } {
	if (comment.status === 'rejected') {
		return {
			tone: 'warn',
			text: unpublishedNote('rejected', comment.moderationReason, comment.moderationRule ?? null)
		};
	}
	if (comment.status === 'pending') {
		const lead = action === 'post' ? 'Comment sent.' : 'Comment saved.';
		return { tone: 'warn', text: `${lead} ${unpublishedNote('pending', null)}` };
	}
	return { tone: 'success', text: action === 'post' ? 'Comment posted.' : 'Comment saved.' };
}
