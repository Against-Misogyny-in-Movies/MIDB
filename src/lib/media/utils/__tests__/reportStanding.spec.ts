import { describe, expect, it } from 'vitest';
import {
	effectiveStanding,
	moderatorStandingLabel,
	readerStandingLabel
} from '../reportStanding.ts';

const NOW = Date.parse('2026-11-10T00:00:00Z');
const PAST = '2026-11-01T00:00:00.000Z';
const FUTURE = '2026-11-20T00:00:00.000Z';

describe('effectiveStanding', () => {
	it('reads a counted report whose account is old enough as counted', () => {
		expect(effectiveStanding({ status: 'counted', countsFrom: PAST }, NOW)).toEqual({
			kind: 'counted'
		});
	});

	it('gives the date a report from a young account starts counting', () => {
		expect(effectiveStanding({ status: 'counted', countsFrom: FUTURE }, NOW)).toEqual({
			kind: 'young',
			countsFrom: FUTURE
		});
	});

	it('keeps a held or rejected report as its status says', () => {
		expect(
			effectiveStanding({ status: 'held', countsFrom: FUTURE, restricted: 'muted' }, NOW).kind
		).toBe('held');
		expect(effectiveStanding({ status: 'rejected', countsFrom: PAST }, NOW).kind).toBe('rejected');
	});

	it('puts a counted report of a muted or banned account out of the counts, young or not', () => {
		expect(
			effectiveStanding({ status: 'counted', countsFrom: FUTURE, restricted: 'muted' }, NOW)
		).toEqual({ kind: 'restricted', by: 'muted' });
		expect(
			effectiveStanding({ status: 'counted', countsFrom: PAST, restricted: 'banned' }, NOW)
		).toEqual({ kind: 'restricted', by: 'banned' });
	});
});

describe('standing labels', () => {
	const counted = { kind: 'counted' } as const;
	const young = { kind: 'young', countsFrom: FUTURE } as const;
	const muted = { kind: 'restricted', by: 'muted' } as const;

	it('reads for the reader', () => {
		expect(readerStandingLabel(counted)).toEqual({ label: 'Counted', tone: 'pos' });
		expect(readerStandingLabel(young).label).toBe('Counts from November 20, 2026');
		expect(readerStandingLabel({ kind: 'held' })).toEqual({
			label: 'Waiting for review',
			tone: 'mid'
		});
		expect(readerStandingLabel({ kind: 'rejected' }).label).toBe('Not counted');
		expect(readerStandingLabel(muted)).toEqual({
			label: 'Not counted: account muted',
			tone: 'neutral'
		});
	});

	it('reads for the moderator, with the reader’s wording where the standing is not a status', () => {
		expect(moderatorStandingLabel({ kind: 'held' })).toEqual({ label: 'Held', tone: 'mid' });
		expect(moderatorStandingLabel({ kind: 'rejected' }).label).toBe('Rejected');
		for (const standing of [counted, young, muted, { kind: 'restricted', by: 'banned' } as const])
			expect(moderatorStandingLabel(standing)).toEqual(readerStandingLabel(standing));
	});
});
