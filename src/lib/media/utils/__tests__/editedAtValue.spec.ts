import { describe, expect, it } from 'vitest';
import { editedAtValue } from '../editedAtValue.ts';

describe('editedAtValue', () => {
	it('is empty for a comment never edited and milliseconds otherwise', () => {
		expect(editedAtValue(null)).toBe('');
		expect(editedAtValue('2026-11-02T10:00:00.123Z')).toBe(
			String(Date.UTC(2026, 10, 2, 10, 0, 0, 123))
		);
	});
});
