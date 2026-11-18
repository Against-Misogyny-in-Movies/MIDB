import { describe, expect, it } from 'vitest';
import { recordLine } from '../reporterRecord.ts';

describe('recordLine', () => {
	it('counts the upheld reports among those a moderator decided', () => {
		expect(recordLine({ upheld: 3, dismissed: 1 })).toBe('Earlier reports: 3 of 4 upheld');
		expect(recordLine({ upheld: 0, dismissed: 2 })).toBe('Earlier reports: 0 of 2 upheld');
	});

	it('says none was decided when nothing was upheld or dismissed', () => {
		expect(recordLine({ upheld: 0, dismissed: 0 })).toBe('Earlier reports: none decided yet');
	});
});
