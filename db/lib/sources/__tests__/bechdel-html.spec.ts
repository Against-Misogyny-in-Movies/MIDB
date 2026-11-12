import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { bechdelYearUrl, parseBechdelRss, parseBechdelYearPage } from '../bechdel-html.ts';

const read = (name: string) => readFileSync(`db/test/fixtures/${name}`, 'utf8');

describe('parseBechdelYearPage', () => {
	it('reads the films of a year with their ids, titles and ratings', () => {
		const films = parseBechdelYearPage(read('bechdel-year-2020.html'), 2020);
		expect(films).toHaveLength(11);
		expect(films[0]).toEqual({
			bechdelId: 12373,
			imdbId: 'tt10309552',
			title: '12 Hour Shift',
			year: 2020,
			rating: 3
		});
		expect(films.map((f) => f.rating).sort()).toEqual([0, 0, 0, 1, 2, 3, 3, 3, 3, 3, 3]);
	});

	it('decodes the entities in titles', () => {
		const titles = parseBechdelYearPage(read('bechdel-year-2020.html'), 2020).map((f) => f.title);
		expect(titles).toContain('Bill & Ted Face the Music');
		expect(titles).toContain("I'm Thinking of Ending Things");
	});

	it('reads a year with one film', () => {
		expect(parseBechdelYearPage(read('bechdel-year-1874.html'), 1874)).toEqual([
			{ bechdelId: 9602, imdbId: 'tt3155794', title: 'Passage de Venus', year: 1874, rating: 0 }
		]);
	});

	it('throws when the page has no film count', () => {
		expect(() => parseBechdelYearPage('<html><body>Maintenance</body></html>', 2020)).toThrow(
			/no film count/
		);
	});

	it('throws when the rows read differ from the count the page declares', () => {
		const shortCount = read('bechdel-year-2020.html').replace('(11 movies)', '(12 movies)');
		expect(() => parseBechdelYearPage(shortCount, 2020)).toThrow(/lists 12 films, 11 rows/);
		const changedMarkup = read('bechdel-year-2020.html').replaceAll(
			'imdb.com/title',
			'imdb.com/name'
		);
		expect(() => parseBechdelYearPage(changedMarkup, 2020)).toThrow(/0 readable/);
	});

	it('builds the page address', () => {
		expect(bechdelYearUrl(1999)).toBe('https://bechdeltest.com/year/1999/');
	});
});

describe('parseBechdelRss', () => {
	it('reads the recent additions', () => {
		expect(parseBechdelRss(read('bechdel-rss.xml'))).toEqual([
			{ bechdelId: 12440, title: 'Digger', year: 2026, rating: 1 },
			{ bechdelId: 12437, title: 'Witches in Stitches', year: 1997, rating: 3 },
			{ bechdelId: 12434, title: 'Practical Magic 2', year: 2026, rating: 3 },
			{ bechdelId: 12431, title: 'Starve Acre', year: 2023, rating: 3 }
		]);
	});

	it('throws on an item it cannot read', () => {
		expect(() => parseBechdelRss('<item rdf:about="x"><title>No year</title></item>')).toThrow(
			/unknown format/
		);
	});

	it('returns nothing for a feed without items', () => {
		expect(parseBechdelRss('<rdf:RDF></rdf:RDF>')).toEqual([]);
	});
});
