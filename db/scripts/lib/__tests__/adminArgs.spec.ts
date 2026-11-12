import { describe, it, expect } from 'vitest';
import { parseAdminArgs } from '../adminArgs.ts';

describe('parseAdminArgs', () => {
	it('reads one of --username or --email', () => {
		expect(parseAdminArgs(['--username', 'ada'])).toEqual({ by: 'username', value: 'ada' });
		expect(parseAdminArgs(['--email', 'a@b.c', '--remote'])).toEqual({
			by: 'email',
			value: 'a@b.c'
		});
	});
	it('rejects none, both, and a missing value', () => {
		expect(parseAdminArgs([])).toBeNull();
		expect(parseAdminArgs(['--username', 'a', '--email', 'b'])).toBeNull();
		expect(parseAdminArgs(['--email'])).toBeNull();
		expect(parseAdminArgs(['--email', '--remote'])).toBeNull();
	});
});
