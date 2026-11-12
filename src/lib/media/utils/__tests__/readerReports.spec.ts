import { describe, it, expect } from 'vitest';
import { getTableColumns } from 'drizzle-orm';
import { communityContentReports } from '#db/schema/community.ts';
import { UM_FLAGS } from '#lib/media/utils/metrics.ts';
import {
	CONCERN_FLAGS,
	REPORT_CATEGORIES,
	READER_REPORT_MIN,
	sexualLevelFromFlags
} from '#lib/media/utils/readerReports.ts';

describe('concern flags', () => {
	it('are the UM flags but noRape, and match the report table columns', () => {
		expect(CONCERN_FLAGS.map((f) => f.key)).toEqual(
			UM_FLAGS.map((f) => f.key).filter((k) => k !== 'noRape')
		);
		const columns = getTableColumns(communityContentReports);
		for (const { key } of CONCERN_FLAGS) {
			expect(columns[key].notNull).toBe(false);
		}
		expect('noRape' in columns).toBe(false);
	});

	it('are all answered by a category field', () => {
		const columns = getTableColumns(communityContentReports);
		for (const c of REPORT_CATEGORIES) expect(c.field in columns).toBe(true);
		expect(READER_REPORT_MIN).toBe(3);
	});
});

describe('sexualLevelFromFlags', () => {
	it('is on screen when an on-screen flag is Yes', () => {
		expect(sexualLevelFromFlags({ rapeOnScreen: true, rapeOffScrn: true })).toBe('on_screen');
		expect(sexualLevelFromFlags({ sexHarOnScrn: true })).toBe('on_screen');
		expect(sexualLevelFromFlags({ childSexAbuse: true })).toBe('on_screen');
	});

	it('is mentioned when only a mentioned or off-screen flag is Yes', () => {
		expect(sexualLevelFromFlags({ rapeMenDisImp: true })).toBe('mentioned');
		expect(sexualLevelFromFlags({ rapeOffScrn: true })).toBe('mentioned');
	});

	it('is none when every flag is No, and not sure otherwise', () => {
		const allNo = Object.fromEntries(CONCERN_FLAGS.map((f) => [f.key, false]));
		expect(sexualLevelFromFlags(allNo)).toBe('none');
		expect(sexualLevelFromFlags({ ...allNo, incest: null })).toBeNull();
		expect(sexualLevelFromFlags({})).toBeNull();
	});
});
