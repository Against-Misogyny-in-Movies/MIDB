import { describe, expect, it } from 'vitest';
import { FEMINIST_ICONS } from '#lib/media/utils/feminist-icons.ts';
import {
	NEW_USERNAME_MIN,
	NEW_USERNAME_PATTERN,
	NEW_USERNAME_RE,
	USERNAME_LOOKUP_RE,
	USERNAME_MAX,
	foldUsername
} from '#lib/media/utils/username.ts';

describe('NEW_USERNAME_RE', () => {
	it.each(['abcd', 'a1b2', 'ada_bea', 'a_b_c_d', 'a'.repeat(USERNAME_MAX), 'z999'])(
		'accepts %s',
		(name) => expect(NEW_USERNAME_RE.test(name)).toBe(true)
	);

	it.each([
		'abc',
		'',
		'a'.repeat(USERNAME_MAX + 1),
		'1234',
		'9lives',
		'_abc',
		'abc_',
		'ab__cd',
		'Abcd',
		'ab-cd',
		'ab cd',
		'abcd\n'
	])('refuses %j', (name) => expect(NEW_USERNAME_RE.test(name)).toBe(false));

	it('has a minimum of four and the pattern the form uses', () => {
		expect(NEW_USERNAME_MIN).toBe(4);
		for (const name of ['abcd', 'a_b1', '1abc', 'ab__c', 'abc_']) {
			const formAllows = new RegExp(`^(?:${NEW_USERNAME_PATTERN})$`, 'v').test(name);
			expect(formAllows && name.length >= NEW_USERNAME_MIN).toBe(NEW_USERNAME_RE.test(name));
		}
	});
});

describe('USERNAME_LOOKUP_RE', () => {
	it.each(['abc', '9lives', 'a__b_', '123', 'a'.repeat(USERNAME_MAX)])(
		'still accepts the stored shape %s',
		(name) => expect(USERNAME_LOOKUP_RE.test(name)).toBe(true)
	);

	it.each(['ab', 'Abc', 'a b', 'a'.repeat(USERNAME_MAX + 1)])('refuses %j', (name) =>
		expect(USERNAME_LOOKUP_RE.test(name)).toBe(false)
	);
});

describe('foldUsername', () => {
	it('folds 1 to l and 0 to o after lowercasing, and nothing else', () => {
		expect(foldUsername('He110_W0rld')).toBe('hello_world');
		expect(foldUsername('i_5_3')).toBe('i_5_3');
	});
});

describe('generated usernames', () => {
	it('every feminist icon plus `_` and four digits passes the new rule', () => {
		for (const icon of FEMINIST_ICONS) {
			expect(NEW_USERNAME_RE.test(`${icon}_0000`), icon).toBe(true);
			expect(NEW_USERNAME_RE.test(`${icon}_9999`), icon).toBe(true);
		}
	});
});
