import type { CommentStatus, ModerationSource } from '#lib/media/types/comments.ts';
import { env } from '#lib/server/env.ts';
import { findBlocklistHit } from './blocklist.ts';
import { isLocalOrigin } from '#lib/server/http/origin.ts';
import { classifyComment, type ClassifyInput } from './classify.ts';
import { applyPolicy, type CheckOutcome } from './policy.ts';

export type DecideInput = ClassifyInput;

/** What a new or edited comment is stored as. */
export interface Decision {
	status: Extract<CommentStatus, 'pending' | 'published' | 'rejected'>;
	source: ModerationSource | null;
	reason: string | null;
	/** The classifier's verdict as JSON text, when one ran; a failed check stores its code. */
	aiVerdict: string | null;
}

/** `MODERATION_DEV_AUTO_APPROVE=1` publishes unchecked comments, and only on a localhost origin. */
function devAutoApprove(): boolean {
	return env.MODERATION_DEV_AUTO_APPROVE === '1' && isLocalOrigin(env.PUBLIC_ORIGIN);
}

/**
 * The single place that decides what status a new or edited comment starts in. The blocklist
 * runs first and needs no API call; then the classifier; then `applyPolicy`. With no
 * `ANTHROPIC_API_KEY` a comment waits for a moderator, unless the dev override publishes it on
 * localhost.
 */
export async function decideStatus(input: DecideInput): Promise<Decision> {
	const hit = findBlocklistHit(input.body);
	if (hit) return decision(applyPolicy({ kind: 'blocklist', term: hit.term }), null);

	const result = await classifyComment(input);
	if (!result.ok && result.code === 'ai-unavailable' && devAutoApprove()) {
		return { status: 'published', source: null, reason: null, aiVerdict: null };
	}
	if (!result.ok && result.code !== 'ai-unavailable') {
		console.warn(`Comment moderation gave no verdict: ${result.code}`);
	}

	const outcome: CheckOutcome = result.ok
		? { kind: 'verdict', verdict: result.verdict }
		: { kind: 'failure', code: result.code };
	const aiVerdict = result.ok
		? JSON.stringify({ ...result.verdict, model: result.model })
		: result.code === 'ai-unavailable'
			? null
			: JSON.stringify({ failure: result.code });
	return decision(applyPolicy(outcome), aiVerdict);
}

function decision(result: ReturnType<typeof applyPolicy>, aiVerdict: string | null): Decision {
	return { ...result, aiVerdict };
}
