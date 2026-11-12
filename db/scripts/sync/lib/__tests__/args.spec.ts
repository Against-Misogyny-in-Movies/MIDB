import { describe, it, expect } from 'vitest';
import { parseSyncArgs } from '../args.ts';

describe('parseSyncArgs', () => {
	it('defaults to the local database and the recent Bechdel years', () => {
		expect(parseSyncArgs([])).toEqual({ target: 'local', fixtures: false, full: false });
		expect(parseSyncArgs(['--remote', '--full'])).toEqual({
			target: 'remote',
			fixtures: false,
			full: true
		});
	});

	it('sweeps in full on the fixtures', () => {
		expect(parseSyncArgs(['--local', '--fixtures'])).toMatchObject({ fixtures: true, full: true });
	});

	it('refuses the fixtures on the remote database', () => {
		expect(() => parseSyncArgs(['--fixtures', '--remote'])).toThrow(/--fixtures.*--remote/);
	});

	it('refuses --local with --remote', () => {
		expect(() => parseSyncArgs(['--local', '--remote'])).toThrow(/not both/);
	});
});
