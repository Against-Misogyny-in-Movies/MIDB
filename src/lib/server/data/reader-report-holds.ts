import {
	BURST_COUNT,
	CONCERN_FLAGS,
	NEW_ACCOUNT_DAYS,
	NEW_ACCOUNT_REPORT_MAX,
	type ConcernFlagKey,
	type SexualLevel
} from '#lib/media/utils/readerReports.ts';
import type { holdReason } from '#lib/media/utils/readerReports.ts';

export type HoldReason = (typeof holdReason)[number];

/** The facts the three hold rules read, loaded by `reader-reports.ts`. */
export type HoldFacts = {
	/** The report's sexual-violence and flag answers; null is not sure. */
	sexualPresent: SexualLevel | null;
	flags: Partial<Record<ConcernFlagKey, boolean | null>>;
	/** The title's Unconsenting Media concern flags, or null when it has no UM binding. */
	um: Record<ConcernFlagKey, boolean> | null;
	/** Reports on the title from other accounts, not rejected, inside the burst window. */
	othersInWindow: number;
	/** Whether this report was created (now, for an insert) inside the burst window. */
	createdInWindow: boolean;
	/** The account's age in days. */
	accountAgeDays: number;
	/** The account's reports on other titles, not rejected. */
	accountOtherReports: number;
};

/**
 * The report says sexual violence is "Not shown", or answers "No" to a flag Unconsenting Media
 * marks, on a title whose UM entry has a concern flag. "Not sure" never contradicts.
 */
export function contradictsSource(f: HoldFacts): boolean {
	if (!f.um || !CONCERN_FLAGS.some((c) => f.um?.[c.key])) return false;
	if (f.sexualPresent === 'none') return true;
	return CONCERN_FLAGS.some((c) => f.um?.[c.key] === true && f.flags[c.key] === false);
}

/**
 * The report is the `BURST_COUNT`th (or later) on its title inside the window. It counts
 * itself only when it was created inside the window, so an old report counts only the others
 * and is held when the others alone reach `BURST_COUNT`.
 */
export function isBurst(f: HoldFacts): boolean {
	return f.othersInWindow + (f.createdInWindow ? 1 : 0) >= BURST_COUNT;
}

/** A young account that has made more than `NEW_ACCOUNT_REPORT_MAX` reports, this one included. */
export function isBusyNewAccount(f: HoldFacts): boolean {
	return f.accountAgeDays < NEW_ACCOUNT_DAYS && f.accountOtherReports + 1 > NEW_ACCOUNT_REPORT_MAX;
}

/** The first rule that holds the report, in the order the rules are listed, or null. */
export function holdReasonFor(f: HoldFacts): HoldReason | null {
	if (contradictsSource(f)) return 'contradicts_source';
	if (isBurst(f)) return 'burst';
	if (isBusyNewAccount(f)) return 'busy_new_account';
	return null;
}
