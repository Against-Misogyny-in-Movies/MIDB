import type { CommentStatus } from '#lib/media/types/comments.ts';
import type { Verdict } from './verdict.ts';

/** A `reject` verdict at or above this severity rejects the comment; below it a person decides. */
export const REJECT_MIN_SEVERITY = 2;

/** What the automatic check found, before it becomes a status. */
export type CheckOutcome =
	| { kind: 'blocklist' }
	| { kind: 'verdict'; verdict: Verdict }
	| { kind: 'failure'; code: string };

export interface PolicyResult {
	status: Extract<CommentStatus, 'pending' | 'published' | 'rejected'>;
	source: 'ai' | 'blocklist' | null;
	/** Shown to the author when the comment is rejected. */
	reason: string | null;
}

/** What the author reads when a blocklisted term rejects the comment. */
export const BLOCKLIST_REASON = 'The comment contains a word the site does not allow.';

/**
 * Turns the automatic check into a status, the same way for every comment: a blocklist hit
 * rejects; `allow` publishes; `review`, and any failure of the check, wait for a person; `reject`
 * rejects at severity `REJECT_MIN_SEVERITY` or more and waits for a person below it.
 */
export function applyPolicy(outcome: CheckOutcome): PolicyResult {
	if (outcome.kind === 'blocklist') {
		return { status: 'rejected', source: 'blocklist', reason: BLOCKLIST_REASON };
	}
	if (outcome.kind === 'failure') return { status: 'pending', source: null, reason: null };

	const { decision, severity, reason } = outcome.verdict;
	if (decision === 'allow') return { status: 'published', source: 'ai', reason: null };
	if (decision === 'reject' && severity >= REJECT_MIN_SEVERITY) {
		return { status: 'rejected', source: 'ai', reason };
	}
	return { status: 'pending', source: 'ai', reason: null };
}
