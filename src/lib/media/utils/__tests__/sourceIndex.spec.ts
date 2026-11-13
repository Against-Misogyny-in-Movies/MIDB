import { describe, expect, test } from 'vitest';
import type { DddResult, TriggerTag } from '#lib/media/types/ddd.ts';
import { sourceIndex } from '#lib/media/utils/sourceIndex.ts';

const tag = (season: number | null): TriggerTag => ({
	topicItemId: 1,
	topicId: 1,
	doesName: 'a dog dies',
	yesSum: 5,
	noSum: 1,
	comment: null,
	category: 'Animals',
	season,
	episode: season === null ? null : 1
});
const entry = (tags: TriggerTag[], itemId: number | null = 1): DddResult => ({
	itemId,
	tags,
	isSeries: false
});

const base = {
	kind: 'movie' as const,
	bechdelRating: null,
	umConcerns: null,
	umCandidateCount: 0,
	ddd: entry([], null),
	dddVisibleCount: 0
};

describe('sourceIndex', () => {
	test('movie with every source', () => {
		const [bechdel, um, ddd] = sourceIndex({
			...base,
			bechdelRating: 3,
			umConcerns: 1,
			ddd: entry([tag(null)]),
			dddVisibleCount: 4
		});
		expect(bechdel).toMatchObject({ value: '3/3', href: '#bechdel', hasData: true });
		expect(um).toMatchObject({ value: '1 concern', href: '#unconsenting', hasData: true });
		expect(ddd).toMatchObject({ value: '4 warnings', href: '#ddd', hasData: true, busy: false });
	});

	test('missing sources read "No data"', () => {
		const values = sourceIndex(base).map((i) => [i.value, i.hasData]);
		expect(values).toEqual([
			['No data', false],
			['No data', false],
			['No data', false]
		]);
	});

	test('series: Bechdel does not apply and has no anchor', () => {
		const [bechdel] = sourceIndex({ ...base, kind: 'tv', bechdelRating: 3 });
		expect(bechdel).toMatchObject({ value: 'Not applicable', href: null, hasData: false });
	});

	test('UM candidates waiting for a pick', () => {
		const [, um] = sourceIndex({ ...base, umCandidateCount: 3 });
		expect(um).toMatchObject({ value: '3 possible matches', hasData: true });
	});

	test('DDD still streaming', () => {
		const [, , ddd] = sourceIndex({ ...base, ddd: null });
		expect(ddd).toMatchObject({ value: 'Loading…', busy: true, hasData: false });
	});

	test('DDD entry with no warnings reads "No warnings"', () => {
		const [, , ddd] = sourceIndex({ ...base, ddd: entry([]) });
		expect(ddd).toMatchObject({ value: 'No warnings', hasData: false, busy: false });
	});

	test('DDD series with a season picked and no warnings reads "No warnings"', () => {
		const [, , ddd] = sourceIndex({
			...base,
			ddd: entry([tag(2)]),
			dddVisibleCount: 0,
			dddSeasonPicked: true
		});
		expect(ddd).toMatchObject({ value: 'No warnings', hasData: false });
	});

	test('DDD series with warnings only on episodes reads "Warnings by episode"', () => {
		const [, , ddd] = sourceIndex({ ...base, ddd: entry([tag(2)]), dddVisibleCount: 0 });
		expect(ddd).toMatchObject({ value: 'Warnings by episode', hasData: true });
	});
});
