import { describe, it, expect } from 'vitest';
import { buildCleanTitleIndex, matchUmFilm } from '../um-match.ts';

const index = buildCleanTitleIndex([
	{ id: 'a', cleanTitle: 'ava', year: 2020 },
	{ id: 'b', cleanTitle: 'ava', year: 2017 },
	{ id: 'c', cleanTitle: 'breach', year: 2020 },
	{ id: 'd', cleanTitle: 'host', year: null },
	{ id: 'e', cleanTitle: 'host', year: 2020 }
]);

describe('matchUmFilm', () => {
	it('matches the only film with the key, whatever the years', () => {
		expect(matchUmFilm(index, 'breach', 1999)).toEqual({ kind: 'matched', titleId: 'c' });
		expect(matchUmFilm(index, 'breach', null)).toEqual({ kind: 'matched', titleId: 'c' });
	});

	it('picks among several by the exact year', () => {
		expect(matchUmFilm(index, 'ava', 2017)).toEqual({ kind: 'matched', titleId: 'b' });
		expect(matchUmFilm(index, 'ava', 2020)).toEqual({ kind: 'matched', titleId: 'a' });
	});

	it('leaves several unmatched without a year hit, and lists their years', () => {
		expect(matchUmFilm(index, 'ava', 1999)).toEqual({
			kind: 'ambiguous',
			candidateYears: [2020, 2017]
		});
		expect(matchUmFilm(index, 'host', null)).toEqual({
			kind: 'ambiguous',
			candidateYears: [null, 2020]
		});
	});

	it('reports a key no film has', () => {
		expect(matchUmFilm(index, 'nothing', 2020)).toEqual({ kind: 'no_match' });
	});
});
