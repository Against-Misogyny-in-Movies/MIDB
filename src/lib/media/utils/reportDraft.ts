import {
	CONCERN_FLAGS,
	type ConcernFlagKey,
	type ObjectificationLevel,
	type ReportFraming,
	type ReportLevel,
	type SexualLevel
} from '#lib/media/utils/communityReports.ts';
import type { ViewerReportView } from '#lib/media/types/community-reports.ts';

/** A radio group cannot hold null, so "not sure" is its own value in the form. */
export const UNSURE = 'unsure';
type Answer<T extends string> = T | typeof UNSURE;

export type FlagAnswer = 'yes' | 'no' | typeof UNSURE;

/** The form's state: every question has an answer, "not sure" by default. */
export type ReportDraft = {
	watched: boolean;
	sexual: Answer<SexualLevel>;
	partner: Answer<ReportLevel>;
	physical: Answer<ReportLevel>;
	stalking: Answer<ReportLevel>;
	objectification: Answer<ObjectificationLevel>;
	flags: Record<ConcernFlagKey, FlagAnswer>;
	/** `''` is "not answered". */
	framing: ReportFraming | '';
};

const flagsOf = (value: (key: ConcernFlagKey) => FlagAnswer) =>
	Object.fromEntries(CONCERN_FLAGS.map((f) => [f.key, value(f.key)])) as Record<
		ConcernFlagKey,
		FlagAnswer
	>;

export function emptyDraft(): ReportDraft {
	return {
		watched: false,
		sexual: UNSURE,
		partner: UNSURE,
		physical: UNSURE,
		stalking: UNSURE,
		objectification: UNSURE,
		flags: flagsOf(() => UNSURE),
		framing: ''
	};
}

const orUnsure = <T extends string>(value: T | null): Answer<T> => value ?? UNSURE;

/** The form filled in from the reader's saved report; a saved report was made by someone who watched. */
export function draftFromReport(report: ViewerReportView): ReportDraft {
	return {
		watched: true,
		sexual: orUnsure(report.sexualPresent),
		partner: orUnsure(report.partnerLevel),
		physical: orUnsure(report.physicalLevel),
		stalking: orUnsure(report.stalkingLevel),
		objectification: orUnsure(report.objectificationLevel),
		flags: flagsOf((key) => (report[key] === true ? 'yes' : report[key] === false ? 'no' : UNSURE)),
		framing: report.framing ?? ''
	};
}

/** The flags are asked only when sexual violence is Present. */
export const asksFlags = (draft: ReportDraft): boolean => draft.sexual === 'present';

/** The framing question is asked only when some violence category says the violence is shown or implied. */
export function asksFraming(draft: ReportDraft): boolean {
	return (
		draft.sexual === 'present' ||
		[draft.partner, draft.physical, draft.stalking].some(
			(a) => a === 'mentioned' || a === 'on_screen'
		)
	);
}

/**
 * Whether every level question is "not sure". The flags and the framing are asked only after a
 * non-"not sure" answer, so they cannot hold one.
 */
export const allUnsure = (draft: ReportDraft): boolean =>
	[draft.sexual, draft.partner, draft.physical, draft.stalking, draft.objectification].every(
		(answer) => answer === UNSURE
	);

/** Save waits for "I watched this". */
export const canSave = (draft: ReportDraft): boolean => draft.watched;

const orNull = <T extends string>(answer: Answer<T>): T | null =>
	answer === UNSURE ? null : answer;

/** The body of `PUT …/reports`: answers to questions that are not asked are left out. */
export function reportBody(draft: ReportDraft) {
	const flags: Partial<Record<ConcernFlagKey, boolean | null>> = {};
	if (asksFlags(draft))
		for (const { key } of CONCERN_FLAGS)
			flags[key] = draft.flags[key] === 'yes' ? true : draft.flags[key] === 'no' ? false : null;
	return {
		watched: true as const,
		sexualPresent: orNull(draft.sexual),
		partnerLevel: orNull(draft.partner),
		physicalLevel: orNull(draft.physical),
		stalkingLevel: orNull(draft.stalking),
		objectificationLevel: orNull(draft.objectification),
		flags,
		framing: asksFraming(draft) && draft.framing ? draft.framing : null
	};
}
