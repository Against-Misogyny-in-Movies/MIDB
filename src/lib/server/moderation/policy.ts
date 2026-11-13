import type { CommentStatus } from '#lib/media/types/comments.ts';
import type { Verdict } from './verdict.ts';

/** A `reject` verdict at or above this severity rejects the comment; below it a person decides. */
export const REJECT_MIN_SEVERITY = 2;

/** What the automatic check found, before it becomes a status. */
export type CheckOutcome =
	| { kind: 'blocklist'; term: string | null }
	| { kind: 'verdict'; verdict: Verdict }
	| { kind: 'failure'; code: string };

export interface PolicyResult {
	status: Extract<CommentStatus, 'pending' | 'published' | 'rejected'>;
	source: 'ai' | 'blocklist' | null;
	/** Shown to the author when the comment is rejected. */
	reason: string | null;
}

/** What the author reads when a private blocklist term rejects the comment: the list stays private. */
export const BLOCKLIST_REASON = 'The comment contains a word or phrase the site does not allow.';

/** The reason for a blocklist hit: it names the term when it is on the public list. */
export const blocklistReason = (term: string | null): string =>
	term === null
		? BLOCKLIST_REASON
		: `The comment contains "${term}", which the site does not allow.`;

/**
 * Turns the automatic check into a status, the same way for every comment: a blocklist hit
 * rejects; `allow` publishes only with severity 0 and no categories, and any other `allow` waits for
 * a person; `review`, and any failure of the check, wait for a person; `reject`
 * rejects at severity `REJECT_MIN_SEVERITY` or more and waits for a person below it.
 */
export function applyPolicy(outcome: CheckOutcome): PolicyResult {
	if (outcome.kind === 'blocklist') {
		return { status: 'rejected', source: 'blocklist', reason: blocklistReason(outcome.term) };
	}
	if (outcome.kind === 'failure') return { status: 'pending', source: null, reason: null };

	const { decision, severity, categories, reason } = outcome.verdict;
	if (decision === 'allow' && severity === 0 && categories.length === 0) {
		return { status: 'published', source: 'ai', reason: null };
	}
	if (decision === 'reject' && severity >= REJECT_MIN_SEVERITY) {
		return { status: 'rejected', source: 'ai', reason };
	}
	return { status: 'pending', source: 'ai', reason: null };
}
