/**
 * The reader-report vocabulary and thresholds, defined once for the endpoints, the form, the
 * counts and the Methodology copy. The enum tuples the schema's CHECKs also use live in
 * `db/lib/readerReports.ts` and are re-exported here.
 */

import { UM_FLAGS, type UmFlagKey } from '#lib/media/utils/metrics.ts';
import type { reportFraming, reportLevel, objectificationLevel } from '#db/lib/readerReports.ts';

export {
	contentReportStatus,
	holdReason,
	objectificationLevel,
	reportFraming,
	reportLevel
} from '#db/lib/readerReports.ts';

export type ReportLevel = (typeof reportLevel)[number];
export type ObjectificationLevel = (typeof objectificationLevel)[number];
export type ReportFraming = (typeof reportFraming)[number];

/** The eight Unconsenting Media concern flags a report can answer: every flag except `noRape`. */
export type ConcernFlagKey = Exclude<UmFlagKey, 'noRape'>;

export const CONCERN_FLAGS: readonly { key: ConcernFlagKey; label: string }[] = UM_FLAGS.flatMap(
	(f) => (f.key === 'noRape' ? [] : [{ key: f.key, label: f.label }])
);

/** Counted reports needed before the counts show; below it the section gives the total only. */
export const READER_REPORT_MIN = 3;

/** An account's reports count once it is this many days old. */
export const REPORT_ACCOUNT_MIN_AGE_DAYS = 7;

/** A report is held when this many reports on one title (its own included) fall in this window. */
export const BURST_WINDOW_HOURS = 24;
export const BURST_COUNT = 10;

/** A report is held when its account is younger than `NEW_ACCOUNT_DAYS` and has more than `NEW_ACCOUNT_REPORT_MAX` reports. */
export const NEW_ACCOUNT_DAYS = 30;
export const NEW_ACCOUNT_REPORT_MAX = 10;

export const REPORT_CATEGORIES = [
	{
		key: 'sexual',
		field: 'sexualPresent',
		label: 'Sexual violence',
		description: 'Rape, sexual assault or sexual harassment of women or girls.',
		levels: 'violence'
	},
	{
		key: 'partner',
		field: 'partnerLevel',
		label: 'Partner or family abuse',
		description: 'Abuse of a woman or girl by a partner or a family member.',
		levels: 'violence'
	},
	{
		key: 'physical',
		field: 'physicalLevel',
		label: 'Physical violence or murder',
		description: 'Beating, injury or killing of women or girls.',
		levels: 'violence'
	},
	{
		key: 'stalking',
		field: 'stalkingLevel',
		label: 'Stalking or harassment',
		description: 'Stalking, threats or sustained harassment of women or girls.',
		levels: 'violence'
	},
	{
		key: 'objectification',
		field: 'objectificationLevel',
		label: 'Sexual objectification',
		description: 'The camera dwelling on women’s bodies, or women written only as sexual objects.',
		levels: 'objectification'
	}
] as const;

export type ReportCategory = (typeof REPORT_CATEGORIES)[number]['key'];
export type ReportCategoryField = (typeof REPORT_CATEGORIES)[number]['field'];

/** The labels of each level set; a missing answer (NULL) reads as not sure. */
export const REPORT_LEVEL_LABELS: Record<ReportLevel, string> = {
	none: 'Not shown',
	mentioned: 'Mentioned or implied',
	on_screen: 'On screen'
};

export const OBJECTIFICATION_LEVEL_LABELS: Record<ObjectificationLevel, string> = {
	none: 'Not present',
	some_scenes: 'In some scenes',
	throughout: 'Throughout'
};

export const REPORT_FRAMING_LABELS: Record<ReportFraming, string> = {
	condemned: 'Shown as wrong, with consequences',
	unclear: 'Unclear',
	played_for_laughs: 'Played for laughs',
	glamorised_or_justified: 'Glamorised or justified'
};

/** The flags that put a title's sexual violence on screen and those that only mention or imply it. */
const ON_SCREEN_FLAGS: readonly ConcernFlagKey[] = [
	'sexHarOnScrn',
	'sexAdultTeen',
	'childSexAbuse',
	'incest',
	'attemptedRape',
	'rapeOnScreen'
];
const MENTIONED_FLAGS: readonly ConcernFlagKey[] = ['rapeMenDisImp', 'rapeOffScrn'];

/**
 * The level of the sexual category that a reader's flag answers imply: `on_screen` when an
 * on-screen flag is Yes, else `mentioned` when a mentioned flag is Yes, else `none` when every
 * flag is No, else null (not sure). This is the one place the mapping is written.
 */
export function sexualLevelFromFlags(
	flags: Partial<Record<ConcernFlagKey, boolean | null>>
): ReportLevel | null {
	if (ON_SCREEN_FLAGS.some((k) => flags[k] === true)) return 'on_screen';
	if (MENTIONED_FLAGS.some((k) => flags[k] === true)) return 'mentioned';
	return CONCERN_FLAGS.every((f) => flags[f.key] === false) ? 'none' : null;
}
