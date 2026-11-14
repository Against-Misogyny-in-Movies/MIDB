import { describe, it, expect } from 'vitest';
import { usernameRefusal } from '../username-check.ts';

describe('usernameRefusal', () => {
	it.each([
		['admin', 'reserved'],
		['super_administrator', 'reserved'],
		['xmoderatorx', 'reserved'],
		['midb_official', 'reserved'],
		['m1db', 'reserved'],
		['m_1_d_b', 'reserved'],
		['admіn_x', 'reserved'],
		['support', 'reserved'],
		['the_staff', 'reserved'],
		['faggot', 'blocked'],
		['f4ggots', 'blocked'],
		['kill_yourself', 'blocked'],
		['k_y_s', 'blocked']
	])('refuses %s as %s', (name, reason) => {
		expect(usernameRefusal(name)).toBe(reason);
	});

	it.each([
		'mary_w',
		'kyle_77',
		'rootsy',
		'supporter',
		'film_fan',
		'brad_mine',
		'sad_mint',
		'ahmed_in',
		'ada_mid_bay'
	])('allows %s', (name) => {
		expect(usernameRefusal(name)).toBeNull();
	});
});
