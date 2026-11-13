import { describe, expect, it } from 'vitest';
import { reportStanding } from '../reportStanding.ts';

const NOW = Date.parse('2026-11-10T00:00:00Z');
const PAST = '2026-11-01T00:00:00.000Z';
const FUTURE = '2026-11-20T00:00:00.000Z';

describe('reportStanding', () => {
	it('reads a counted report whose account is old enough as counted', () => {
		expect(reportStanding({ status: 'counted', countsFrom: PAST }, { now: NOW })).toEqual({
			label: 'Counted',
			tone: 'pos'
		});
	});

	it('names the date a report from a young account starts counting', () => {
		const standing = reportStanding({ status: 'counted', countsFrom: FUTURE }, { now: NOW });
		expect(standing.label).toBe('Counts from November 20, 2026');
	});

	it('reads a held report as waiting for review and a rejected one as not counted', () => {
		expect(reportStanding({ status: 'held', countsFrom: PAST }, { now: NOW }).label).toBe(
			'Waiting for review'
		);
		expect(reportStanding({ status: 'rejected', countsFrom: PAST }, { now: NOW }).label).toBe(
			'Not counted'
		);
	});

	it('reads a counted report of a restricted account as not counted', () => {
		expect(
			reportStanding({ status: 'counted', countsFrom: PAST }, { restricted: true, now: NOW }).label
		).toBe('Not counted');
	});
});
