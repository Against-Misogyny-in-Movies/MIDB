import { describe, it, expect } from 'vitest';
import {
	contradictsSource,
	holdReasonFor,
	isBurst,
	isBusyNewAccount,
	type HoldFacts
} from '#lib/server/data/community-report-holds.ts';
import {
	BURST_COUNT,
	NEW_ACCOUNT_DAYS,
	NEW_ACCOUNT_REPORT_MAX,
	type ConcernFlagKey
} from '#lib/media/utils/communityReports.ts';

const NO_UM_FLAGS: Record<ConcernFlagKey, boolean> = {
	rapeMenDisImp: false,
	sexHarOnScrn: false,
	sexAdultTeen: false,
	childSexAbuse: false,
	incest: false,
	attemptedRape: false,
	rapeOffScrn: false,
	rapeOnScreen: false
};

const facts = (over: Partial<HoldFacts> = {}): HoldFacts => ({
	sexualPresent: null,
	flags: {},
	um: null,
	othersInWindow: 0,
	createdInWindow: true,
	accountAgeDays: 100,
	accountOtherReports: 0,
	...over
});

describe('contradictsSource', () => {
	const um = { ...NO_UM_FLAGS, rapeOnScreen: true };

	it('holds "Not shown" on a title UM flags', () => {
		expect(contradictsSource(facts({ um, sexualPresent: 'none' }))).toBe(true);
	});

	it('holds "No" to a flag UM marks', () => {
		expect(
			contradictsSource(facts({ um, sexualPresent: 'present', flags: { rapeOnScreen: false } }))
		).toBe(true);
	});

	it('never holds "Not sure"', () => {
		expect(contradictsSource(facts({ um, sexualPresent: null }))).toBe(false);
		expect(contradictsSource(facts({ um, flags: { rapeOnScreen: null } }))).toBe(false);
	});

	it('does not hold a matching answer, a "No" on a flag UM leaves unmarked, or a title with no flags', () => {
		expect(
			contradictsSource(facts({ um, sexualPresent: 'present', flags: { rapeOnScreen: true } }))
		).toBe(false);
		expect(
			contradictsSource(facts({ um, sexualPresent: 'present', flags: { incest: false } }))
		).toBe(false);
		expect(contradictsSource(facts({ um: NO_UM_FLAGS, sexualPresent: 'none' }))).toBe(false);
		expect(contradictsSource(facts({ um: null, sexualPresent: 'none' }))).toBe(false);
	});
});

describe('isBurst', () => {
	it('holds the report that makes BURST_COUNT in the window', () => {
		expect(isBurst(facts({ othersInWindow: BURST_COUNT - 1 }))).toBe(true);
		expect(isBurst(facts({ othersInWindow: BURST_COUNT - 2 }))).toBe(false);
	});

	it('does not count a report created outside the window', () => {
		const old = { createdInWindow: false };
		expect(isBurst(facts({ ...old, othersInWindow: BURST_COUNT - 1 }))).toBe(false);
		expect(isBurst(facts({ ...old, othersInWindow: BURST_COUNT }))).toBe(true);
	});
});

describe('isBusyNewAccount', () => {
	it('holds a young account past the report maximum, this report included', () => {
		const young = { accountAgeDays: NEW_ACCOUNT_DAYS - 1 };
		expect(isBusyNewAccount(facts({ ...young, accountOtherReports: NEW_ACCOUNT_REPORT_MAX }))).toBe(
			true
		);
		expect(
			isBusyNewAccount(facts({ ...young, accountOtherReports: NEW_ACCOUNT_REPORT_MAX - 1 }))
		).toBe(false);
	});

	it('does not hold an account of NEW_ACCOUNT_DAYS or more', () => {
		expect(
			isBusyNewAccount(
				facts({ accountAgeDays: NEW_ACCOUNT_DAYS, accountOtherReports: NEW_ACCOUNT_REPORT_MAX })
			)
		).toBe(false);
	});
});

describe('holdReasonFor', () => {
	it('is null for a clean report and names the first rule that holds', () => {
		expect(holdReasonFor(facts())).toBeNull();
		expect(holdReasonFor(facts({ othersInWindow: BURST_COUNT }))).toBe('burst');
		expect(
			holdReasonFor(
				facts({
					um: { ...NO_UM_FLAGS, incest: true },
					sexualPresent: 'none',
					othersInWindow: BURST_COUNT
				})
			)
		).toBe('contradicts_source');
	});
});
