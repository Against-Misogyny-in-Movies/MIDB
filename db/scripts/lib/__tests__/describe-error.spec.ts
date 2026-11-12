import { describe, it, expect } from 'vitest';
import { describeError } from '../describe-error.ts';

describe('describeError', () => {
	it('prints the stack of a plain error', () => {
		const error = new Error('plain failure');
		expect(describeError(error)).toBe(error.stack);
	});

	it('prints each cause in the chain after the error', () => {
		const root = new Error('D1 request failed: no such table');
		const wrapped = new Error('Failed query: select 1', { cause: root });
		const text = describeError(wrapped);
		expect(text).toContain('Failed query: select 1');
		expect(text).toContain('Caused by: ');
		expect(text).toContain('D1 request failed: no such table');
		expect(text.indexOf('Failed query')).toBeLessThan(text.indexOf('D1 request failed'));
	});

	it('prints a non-error value as a string and stops on a cycle', () => {
		expect(describeError('boom')).toContain('boom');
		const a = new Error('a');
		a.cause = a;
		expect(describeError(a)).toBe(a.stack);
	});
});
