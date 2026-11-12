import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import {
	bechdelYearUrl,
	parseBechdelRss,
	parseBechdelYearPage,
	readBechdelYear
} from '../bechdel-html.ts';

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

	it('throws when a film row cannot be read', () => {
		const changedMarkup = read('bechdel-year-2020.html').replaceAll(
			'imdb.com/title',
			'imdb.com/name'
		);
		expect(() => parseBechdelYearPage(changedMarkup, 2020)).toThrow(/11 film rows and 0 readable/);
	});

	it('builds the page address, with the page number after the first', () => {
		expect(bechdelYearUrl(1999)).toBe('https://bechdeltest.com/year/1999/');
		expect(bechdelYearUrl(2004, 1)).toBe('https://bechdeltest.com/year/2004/page/1/');
	});
});

describe('readBechdelYear', () => {
	const pages: Record<string, string> = {
		'2004:0': read('bechdel-year-2004.html'),
		'2004:1': read('bechdel-year-2004-page-1.html'),
		'2020:0': read('bechdel-year-2020.html')
	};
	const fetchPage = async (year: number, page: number) => pages[`${year}:${page}`] ?? null;

	it('follows the pager through a year that spans pages', async () => {
		const films = await readBechdelYear(fetchPage, 2004);
		expect(films.map((f) => f.title)).toEqual([
			'13 Going on 30',
			'2046',
			'3-Iron',
			'The Third Society',
			'Three... Extremes'
		]);
	});

	it('reads a one-page year and treats a year with no page as empty', async () => {
		expect(await readBechdelYear(fetchPage, 2020)).toHaveLength(11);
		expect(await readBechdelYear(fetchPage, 1999)).toEqual([]);
	});

	it('throws when a linked page is missing', async () => {
		const noSecond = async (year: number, page: number) =>
			page === 1 ? null : fetchPage(year, page);
		await expect(readBechdelYear(noSecond, 2004)).rejects.toThrow(/no page 1/);
	});

	it('throws when the pages together differ from the declared count', async () => {
		const short = async (year: number, page: number) =>
			(await fetchPage(year, page))?.replaceAll('(5 movies)', '(6 movies)') ?? null;
		await expect(readBechdelYear(short, 2004)).rejects.toThrow(/lists 6 films and 5 were read/);
	});

	it('throws when the pager points somewhere unexpected', async () => {
		const loop = async (year: number, page: number) =>
			page === 1 ? pages['2004:0'] : fetchPage(year, page);
		await expect(readBechdelYear(loop, 2004)).rejects.toThrow(/unexpected page/);
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
