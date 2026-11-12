import { describe, it, expect } from 'vitest';
import { parseTarget } from '../args.ts';

describe('parseTarget', () => {
	it('defaults to local', () => expect(parseTarget([])).toBe('local'));
	it('reads --remote and --local', () => {
		expect(parseTarget(['--remote'])).toBe('remote');
		expect(parseTarget(['--local'])).toBe('local');
	});
	it('rejects both', () => expect(() => parseTarget(['--local', '--remote'])).toThrow());
});
