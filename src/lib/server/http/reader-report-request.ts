import { z } from 'zod';
import {
	CONCERN_FLAGS,
	objectificationLevel,
	reportFraming,
	reportLevel,
	sexualLevel,
	type ConcernFlagKey
} from '#lib/media/utils/readerReports.ts';
import { REPORT_NOTE_MAX } from '#lib/media/utils/comments.ts';
import type { ReportAnswers } from '#lib/server/data/reader-reports.ts';

/** A level answer: a value of the set, or null for "not sure". Absent means null too. */
const answer = <T extends readonly [string, ...string[]]>(values: T) =>
	z
		.enum(values)
		.nullish()
		.transform((v) => v ?? null);

const flagShape = Object.fromEntries(
	CONCERN_FLAGS.map((f) => [f.key, z.boolean().nullish()])
) as Record<ConcernFlagKey, z.ZodOptional<z.ZodNullable<z.ZodBoolean>>>;

/**
 * The body of `PUT …/reports`: the answers, plus `watched`, which must be true ("I watched
 * this"). Unknown keys are dropped, as in the comment schemas. A null or absent level is
 * "not sure", and a null framing is "not answered".
 */
export const reportSchema = z.object({
	watched: z.literal(true),
	sexualPresent: answer(sexualLevel),
	partnerLevel: answer(reportLevel),
	physicalLevel: answer(reportLevel),
	stalkingLevel: answer(reportLevel),
	objectificationLevel: answer(objectificationLevel),
	flags: z.object(flagShape).default({}),
	framing: answer(reportFraming)
});

/** The answers of a validated body, without `watched`. */
export function answersOf(body: z.infer<typeof reportSchema>): ReportAnswers {
	const { watched: _watched, ...answers } = body;
	return answers;
}

/** The body of `POST …/reports/flag`: an optional note. */
export const countFlagSchema = z.object({
	note: z
		.string()
		.trim()
		.max(REPORT_NOTE_MAX)
		.nullish()
		.transform((v) => v || null)
});
