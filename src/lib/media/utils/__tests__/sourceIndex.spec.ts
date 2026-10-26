import { describe, expect, test } from 'vitest';
import { sourceIndex } from '$lib/media/utils/sourceIndex';

const base = {
	kind: 'movie' as const,
	bechdelRating: null,
	umConcerns: null,
	umCandidateCount: 0,
	dddTagCount: 0
};

describe('sourceIndex', () => {
	test('movie with every source', () => {
		const [bechdel, um, ddd] = sourceIndex({
			...base,
			bechdelRating: 3,
			umConcerns: 1,
			dddTagCount: 4
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
		const [, , ddd] = sourceIndex({ ...base, dddTagCount: null });
		expect(ddd).toMatchObject({ value: 'Loading…', busy: true, hasData: false });
	});
});
