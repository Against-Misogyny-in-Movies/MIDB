import { describe, it, expect } from 'vitest';
import { getTableColumns } from 'drizzle-orm';
import { communityContentReports } from '#db/schema/community.ts';
import { UM_FLAGS } from '#lib/media/utils/metrics.ts';
import { CONCERN_FLAGS, REPORT_CATEGORIES, sexualLevel } from '#lib/media/utils/communityReports.ts';

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
	});
});

describe('the sexual category', () => {
	it('is answered Not shown or Present, with a column that holds only those', () => {
		const sexual = REPORT_CATEGORIES.find((c) => c.key === 'sexual');
		expect(sexual?.levels).toBe('sexual');
		expect(sexualLevel).toEqual(['none', 'present']);
	});
});
