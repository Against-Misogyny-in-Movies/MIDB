import { z } from 'zod';

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
	'off-topic'
] as const;

/**
 * What the model is asked for, and what the SDK's own parse checks. `zodOutputFormat` turns a
 * bound (`max`, `min`) into a description and the SDK then throws when the answer breaks it, so
 * this schema carries no bound: a long `reason` or an out-of-range `severity` must not discard
 * the answer before `Verdict` and `classifyComment` have looked at it.
 */
export const ModelVerdict = z.object({
	decision: z.enum(['allow', 'review', 'reject']),
	categories: z.array(z.enum(VERDICT_CATEGORIES)),
	severity: z.number().int(),
	reason: z.string()
});

/**
 * The classifier's answer as the app accepts it. `severity` is 0 (none) to 3 (severe). The
 * `reason` is cut to `MODERATION_REASON_MAX` by `classifyComment`, not rejected here.
 */
export const Verdict = ModelVerdict.extend({ severity: z.number().int().min(0).max(3) });

export type Verdict = z.infer<typeof Verdict>;

/** What a `reject` verdict with an empty reason tells the author. */
export const FALLBACK_REASON = 'The comment does not follow the comment policy.';
