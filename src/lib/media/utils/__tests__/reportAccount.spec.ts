import { describe, expect, it } from 'vitest';
import type { ReportAccount } from '#lib/media/types/moderation.ts';
import { formatMuteHours } from '../comments.ts';
import { accountLine } from '../reportAccount.ts';

const NOW = Date.parse('2026-11-13T00:00:00Z');
const account: ReportAccount = {
	userId: 'u1',
	username: 'anna',
	createdAt: '2026-11-10T00:00:00Z',
	reportCount: 1,
	commentCount: 2,
	role: 'user',
	countsFrom: '2026-11-17T00:00:00Z',
	restricted: null
};

describe('accountLine', () => {
	it('reads the name, age, community reports not rejected and comments', () => {
		expect(accountLine(account, true, NOW)).toBe(
			'anna, 3 days old, 1 community report not rejected, 2 comments'
		);
	});

	it('leaves the name out for a row that names the account already', () => {
		expect(accountLine({ ...account, username: null }, false, NOW)).toBe(
			'3 days old, 1 community report not rejected, 2 comments'
		);
		expect(accountLine({ ...account, username: null }, true, NOW)).toMatch(/^An account, /);
	});
});

describe('formatMuteHours', () => {
	it('reads one day and whole days', () => {
		expect([24, 168, 720].map(formatMuteHours)).toEqual(['1 day', '7 days', '30 days']);
	});
});
