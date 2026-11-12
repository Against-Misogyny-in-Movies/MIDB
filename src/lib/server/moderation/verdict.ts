import { z } from 'zod';
import { MODERATION_REASON_MAX } from '#lib/media/utils/comments.ts';

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

/** The classifier's structured answer. `severity` is 0 (none) to 3 (severe). */
export const Verdict = z.object({
	decision: z.enum(['allow', 'review', 'reject']),
	categories: z.array(z.enum(VERDICT_CATEGORIES)),
	severity: z.number().int().min(0).max(3),
	reason: z.string().max(MODERATION_REASON_MAX)
});

export type Verdict = z.infer<typeof Verdict>;
