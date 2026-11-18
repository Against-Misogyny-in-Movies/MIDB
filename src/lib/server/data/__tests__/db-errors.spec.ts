import { describe, it, expect } from 'vitest';
import { isNotNullViolation, isUniqueViolation } from '#lib/server/data/db-errors.ts';

describe('isUniqueViolation', () => {
	it('matches the D1 message on the wrapped cause', () => {
		const wrapped = new Error('Failed query', {
			cause: new Error('D1_ERROR: UNIQUE constraint failed: titles.imdb_id: SQLITE_CONSTRAINT')
		});
		expect(isUniqueViolation(wrapped)).toBe(true);
	});

	it('matches an unwrapped error', () => {
		expect(isUniqueViolation(new Error('UNIQUE constraint failed: user.id'))).toBe(true);
	});

	it('does not match other constraint errors or non-errors', () => {
		expect(isUniqueViolation(new Error('CHECK constraint failed: rating_range'))).toBe(false);
		expect(isUniqueViolation(new Error('FOREIGN KEY constraint failed'))).toBe(false);
		expect(isUniqueViolation(null)).toBe(false);
		expect(isUniqueViolation('UNIQUE constraint failed')).toBe(false);
	});
});

describe('isNotNullViolation', () => {
	it('matches the named column on the wrapped cause or the error itself', () => {
		const wrapped = new Error('Failed query', {
			cause: new Error('D1_ERROR: NOT NULL constraint failed: user.email: SQLITE_CONSTRAINT')
		});
		expect(isNotNullViolation(wrapped, 'user.email')).toBe(true);
		expect(
			isNotNullViolation(new Error('NOT NULL constraint failed: user.email'), 'user.email')
		).toBe(true);
	});

	it('does not match another column, another constraint or a non-error', () => {
		expect(
			isNotNullViolation(new Error('NOT NULL constraint failed: user.name'), 'user.email')
		).toBe(false);
		expect(
			isNotNullViolation(new Error('UNIQUE constraint failed: user.email'), 'user.email')
		).toBe(false);
		expect(isNotNullViolation(null, 'user.email')).toBe(false);
	});
});
