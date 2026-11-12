/**
 * Bechdel Test (bechdeltest.com) readers. The JSON API is gone, so the data comes from the
 * public year pages and the RSS feed. Every selector lives in `SELECTORS`; a layout change
 * makes the parsers throw instead of returning part of a year.
 */

export const BECHDEL_ORIGIN = 'https://bechdeltest.com';
export const BECHDEL_RSS_URL = `${BECHDEL_ORIGIN}/rss/`;
/** The first year with a film on the site. */
export const BECHDEL_FIRST_YEAR = 1874;

/** A year's films come 200 to a page: page 0 is `/year/<year>/`, then `/year/<year>/page/<n>/`. */
export function bechdelYearUrl(year: number, page = 0): string {
	return page === 0
		? `${BECHDEL_ORIGIN}/year/${year}/`
		: `${BECHDEL_ORIGIN}/year/${year}/page/${page}/`;
}

const SELECTORS = {
	// `<span class="year-count">(184 movies)</span>`: the page's own count of its films.
	yearCount: /class="year-count">\((\d[\d,]*) movies?\)/,
	// One film: the IMDb link with the rating image, then the film's own `/view/<id>/` link.
	film: /<div class="movie"><a href="https:\/\/www\.imdb\.com\/title\/(tt\d+|ttNone)\/"><img [^>]*?alt="\[([0-3])\]"[^>]*><\/a>\s*<a id="movie-(\d+)" href="[^"]*">([^<]*)<\/a>/g,
	// `<div class="movie">` opens every film, so the count of them checks `film` read them all.
	filmStart: /<div class="movie">/g,
	// `<a href="/year/2004/page/1/">continued on next page`, in the pager at the end of a full page.
	nextPage: /<a href="\/year\/(\d+)\/page\/(\d+)\/">continued on next page/,
	rssItem: /<item [^>]*>([\s\S]*?)<\/item>/g,
	rssTitle: /<title>([^<]*)<\/title>/,
	rssLink: /<link>https:\/\/bechdeltest\.com\/view\/(\d+)\//,
	rssRating: /<description>Passed ([0-3]) of 3 tests/
};

const NAMED_ENTITIES: Record<string, string> = {
	amp: '&',
	lt: '<',
	gt: '>',
	quot: '"',
	apos: "'",
	middot: '·',
	hellip: '…',
	nbsp: ' '
};

function decodeEntities(value: string): string {
	return value.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, body: string) => {
		if (body[0] === '#') {
			const code =
				body[1].toLowerCase() === 'x' ? parseInt(body.slice(2), 16) : parseInt(body.slice(1), 10);
			return Number.isFinite(code) && code > 0 && code <= 0x10ffff
				? String.fromCodePoint(code)
				: whole;
		}
		return NAMED_ENTITIES[body.toLowerCase()] ?? whole;
	});
}

export interface BechdelFilm {
	bechdelId: number;
	/** null when the site has no IMDb id for the film (its link ends in `ttNone`). */
	imdbId: string | null;
	title: string;
	year: number;
	/** 0 to 3 */
	rating: number;
}

/** The film count a year page declares for the whole year, every page of it. */
function declaredCount(html: string, year: number): number {
	const declared = SELECTORS.yearCount.exec(html);
	if (!declared) throw new Error(`The Bechdel Test page for ${year} has no film count.`);
	return Number(declared[1].replaceAll(',', ''));
}

/**
 * The films on one page of a year. A page without its film count, or with a film row it cannot
 * read, throws. A year with no films has no page (a 404), which `readBechdelYear` treats as empty.
 */
export function parseBechdelYearPage(html: string, year: number): BechdelFilm[] {
	declaredCount(html, year);
	const films: BechdelFilm[] = [];
	for (const match of html.matchAll(SELECTORS.film)) {
		films.push({
			bechdelId: Number(match[3]),
			imdbId: match[1] === 'ttNone' ? null : match[1],
			title: decodeEntities(match[4]).trim(),
			year,
			rating: Number(match[2])
		});
	}
	const opened = [...html.matchAll(SELECTORS.filmStart)].length;
	if (films.length !== opened) {
		throw new Error(
			`The Bechdel Test page for ${year} has ${opened} film rows and ${films.length} readable.`
		);
	}
	return films;
}

/**
 * Every film of a year: page 0, then each page the pager links to. The pages together must
 * hold the film count the site declares. `fetchPage` returns null for a page the site does not
 * have: page 0 of a year with no films is empty, a missing later page throws.
 */
export async function readBechdelYear(
	fetchPage: (year: number, page: number) => Promise<string | null>,
	year: number
): Promise<BechdelFilm[]> {
	const films: BechdelFilm[] = [];
	let declared = 0;
	for (let page = 0; ; page++) {
		const html = await fetchPage(year, page);
		if (html === null) {
			if (page === 0) return [];
			throw new Error(`The Bechdel Test has no page ${page} for ${year}.`);
		}
		declared = declaredCount(html, year);
		films.push(...parseBechdelYearPage(html, year));
		const next = SELECTORS.nextPage.exec(html);
		if (!next) break;
		if (Number(next[1]) !== year || Number(next[2]) !== page + 1) {
			throw new Error(
				`The Bechdel Test pager for ${year} page ${page} points to an unexpected page.`
			);
		}
	}
	if (films.length !== declared) {
		throw new Error(
			`The Bechdel Test page for ${year} lists ${declared} films and ${films.length} were read.`
		);
	}
	return films;
}

export interface BechdelRecent {
	bechdelId: number;
	title: string;
	year: number;
	rating: number;
}

/** The films on the feed of the last 50 additions: Bechdel id, title, year and rating. */
export function parseBechdelRss(xml: string): BechdelRecent[] {
	const items: BechdelRecent[] = [];
	for (const match of xml.matchAll(SELECTORS.rssItem)) {
		const body = match[1];
		const link = SELECTORS.rssLink.exec(body);
		const title = SELECTORS.rssTitle.exec(body);
		const rating = SELECTORS.rssRating.exec(body);
		const withYear = title ? /^([\s\S]*) \((\d{4})\)$/.exec(decodeEntities(title[1]).trim()) : null;
		if (!link || !rating || !withYear) {
			throw new Error('The Bechdel Test RSS feed has an item in an unknown format.');
		}
		items.push({
			bechdelId: Number(link[1]),
			title: withYear[1],
			year: Number(withYear[2]),
			rating: Number(rating[1])
		});
	}
	return items;
}
