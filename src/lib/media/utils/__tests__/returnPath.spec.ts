import { describe, it, expect } from 'vitest';
import { DEFAULT_RETURN_PATH, safeReturnPath } from '../returnPath.ts';

describe('safeReturnPath', () => {
	it('keeps a same-origin path, with its query and hash', () => {
		expect(safeReturnPath('/movie/348')).toBe('/movie/348');
		expect(safeReturnPath('/tv/1399?season=2#comments')).toBe('/tv/1399?season=2#comments');
	});

	it('falls back when there is no value', () => {
		expect(safeReturnPath(null)).toBe(DEFAULT_RETURN_PATH);
		expect(safeReturnPath('')).toBe(DEFAULT_RETURN_PATH);
		expect(safeReturnPath(undefined, '/x')).toBe('/x');
	});

	it.each([
		'https://evil.example/movie/1',
		'http://evil.example',
		'//evil.example',
		'//evil.example/path',
		'/\\evil.example',
		'\\\\evil.example',
		'/\t/evil.example',
		'/\n/evil.example',
		'/%0d/evil.example/../..//evil.example',
		'/a/../..//evil.example',
		'javascript:alert(1)',
		'movie/348',
		' /movie/348',
		'/auth',
		'/auth/anything',
		`/${'a'.repeat(3000)}`
	])('refuses %j', (value) => {
		expect(safeReturnPath(value)).toBe(DEFAULT_RETURN_PATH);
	});

	it('never returns a path a browser reads as another host', () => {
		for (const value of ['/%2F/evil.example', '/./\t/evil.example', '/%5Cevil.example']) {
			const result = safeReturnPath(value);
			expect(new URL(result, 'https://midb.example').origin).toBe('https://midb.example');
		}
	});
});
