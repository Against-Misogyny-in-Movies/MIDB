import { describe, it, expect } from 'vitest';
import { normalizeTitle, stripTrailingYear } from '../../db/scripts/lib/normalizeTitle';

describe('normalizeTitle', () => {
	it('lowercases and trims', () => {
		expect(normalizeTitle('  The Matrix  ')).toBe('matrix');
	});

	it('strips leading article "The"', () => {
		expect(normalizeTitle('The Shawshank Redemption')).toBe('shawshank redemption');
	});

	it('strips leading article "A"', () => {
		expect(normalizeTitle('A Quiet Place')).toBe('quiet place');
	});

	it('strips leading article "An"', () => {
		expect(normalizeTitle('An American Werewolf in London')).toBe('american werewolf in london');
	});

	it('does not strip article from middle of title', () => {
		expect(normalizeTitle('Beauty and the Beast')).toBe('beauty and the beast');
	});

	it('strips punctuation', () => {
		expect(normalizeTitle("Schindler's List")).toBe('schindlers list');
	});

	it('strips punctuation and article', () => {
		expect(normalizeTitle("The King's Speech")).toBe('kings speech');
	});

	it('handles accented characters (diacritics)', () => {
		expect(normalizeTitle('Amélie')).toBe('amelie');
	});

	it('matches UM cleanNameArticles convention for "A Quiet Place"', () => {
		expect(normalizeTitle('A Quiet Place')).toBe('quiet place');
	});

	it('matches UM cleanNameArticles for "A Quiet Place Part II"', () => {
		expect(normalizeTitle('A Quiet Place Part II')).toBe('quiet place part ii');
	});

	it('collapses multiple spaces', () => {
		expect(normalizeTitle('The   Dark   Knight')).toBe('dark   knight'.replace(/\s+/g, ' '));
	});

	it('handles numbers', () => {
		expect(normalizeTitle('10 Cloverfield Lane')).toBe('10 cloverfield lane');
	});
});

describe('stripTrailingYear', () => {
	it('strips a 2000s year from a normalized title', () => {
		expect(stripTrailingYear('wuthering heights 2026')).toEqual({ key: 'wuthering heights', year: 2026 });
	});

	it('strips a 1900s year', () => {
		expect(stripTrailingYear('wuthering heights 1939')).toEqual({ key: 'wuthering heights', year: 1939 });
	});

	it('returns null year when no trailing year', () => {
		expect(stripTrailingYear('wuthering heights')).toEqual({ key: 'wuthering heights', year: null });
	});

	it('does not strip year-like numbers that are not trailing years', () => {
		expect(stripTrailingYear('2001 a space odyssey')).toEqual({ key: '2001 a space odyssey', year: null });
	});

	it('strips year when it follows a multi-word title', () => {
		expect(stripTrailingYear('quiet place 2020')).toEqual({ key: 'quiet place', year: 2020 });
	});

	it('handles a single-word title with year', () => {
		expect(stripTrailingYear('candyman 2021')).toEqual({ key: 'candyman', year: 2021 });
	});
});
