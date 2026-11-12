import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { parseUmFeed } from '../um-feed.ts';

const feed = JSON.parse(readFileSync('db/test/fixtures/um-list.json', 'utf8')) as Record<
	string,
	unknown
>[];
const item = (umId: number) => feed.find((i) => i.id === umId)!;

describe('parseUmFeed', () => {
	it('keeps films and series and skips every other item type', () => {
		const rows = parseUmFeed(feed);
		expect(feed).toHaveLength(23);
		expect(rows).toHaveLength(21);
		expect(rows.filter((r) => r.kind === 'tv').map((r) => r.umId)).toEqual([973, 4384]);
		expect(new Set(feed.map((i) => i.itemType))).toEqual(
			new Set(['movie', 'TV show', 'book', 'game'])
		);
	});

	it('reads the flags, the comment and the feed date', () => {
		const row = parseUmFeed(feed).find((r) => r.umId === 1449)!;
		expect(row).toMatchObject({
			noRape: true,
			rapeMenDisImp: true,
			sexAdultTeen: true,
			sexHarOnScrn: false,
			rapeOnScreen: false,
			comment: null
		});
		expect(row.sourceUpdatedAt).toEqual(new Date(item(1449).updatedAt as string));
	});

	it('takes the key and the year from UM’s own name, stripping a trailing year', () => {
		const row = parseUmFeed(feed).find((r) => r.umId === 10475)!;
		expect(row).toMatchObject({ cleanName: '10 31 2017', cleanTitleKey: '10 31', year: 2017 });
	});

	it('stores a year of 0 as unknown, never 0', () => {
		expect(item(1449).yearOfRelease).toBe(0);
		expect(parseUmFeed(feed).find((r) => r.umId === 1449)!.year).toBeNull();
	});

	it('returns no rows for an empty feed, for the caller to reject', () => {
		expect(parseUmFeed([])).toEqual([]);
	});

	it('throws when the feed is not an array or a kept item loses a field', () => {
		expect(() => parseUmFeed({ items: [] })).toThrow(/not an array/);
		const { noRape: _dropped, ...broken } = item(1449);
		expect(() => parseUmFeed([broken])).toThrow(/changed shape \(item 1449\)/);
		expect(() => parseUmFeed([{ id: 1 }])).toThrow(/itemType/);
	});

	it('does not validate the items it skips', () => {
		expect(parseUmFeed([{ id: 1, itemType: 'podcast' }])).toEqual([]);
	});
});
