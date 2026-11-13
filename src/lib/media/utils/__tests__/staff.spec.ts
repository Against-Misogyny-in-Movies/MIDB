import { describe, expect, it } from 'vitest';
import { STAFF_ROLES, isStaff } from '../staff.ts';

describe('isStaff', () => {
	it('is true for the staff roles only', () => {
		for (const role of STAFF_ROLES) expect(isStaff(role)).toBe(true);
		expect(isStaff('user')).toBe(false);
		expect(isStaff('')).toBe(false);
	});
});
