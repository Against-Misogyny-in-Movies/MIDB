import { describe, expect, test } from 'vitest';
import type { DddResult, TriggerTag } from '#lib/media/types/ddd.ts';
import { dddStatus } from '#lib/media/utils/dddStatus.ts';

const tag: TriggerTag = {
	topicItemId: 1,
	topicId: 1,
	doesName: 'a dog dies',
	yesSum: 5,
	noSum: 1,
	comment: null,
	category: 'Animals',
	season: 2,
	episode: 1
};
const result = (tags: TriggerTag[], itemId: number | null = 1): DddResult => ({
	itemId,
	tags,
	isSeries: true
});

describe('dddStatus', () => {
	test('loading', () => {
		expect(dddStatus(null, 0)).toEqual({ label: 'Loading…', hasData: false, busy: true });
	});

	test('counts the visible warnings', () => {
		expect(dddStatus(result([tag]), 1)).toMatchObject({ label: '1 warning', hasData: true });
		expect(dddStatus(result([tag, tag]), 2).label).toBe('2 warnings');
	});

	test('no DDD entry reads "No data"', () => {
		expect(dddStatus(result([], null), 0)).toMatchObject({ label: 'No data', hasData: false });
	});

	test('an entry with no warnings reads "No warnings"', () => {
		expect(dddStatus(result([]), 0)).toMatchObject({ label: 'No warnings', hasData: false });
	});

	test('a picked season with no warnings reads "No warnings"', () => {
		expect(dddStatus(result([tag]), 0, true)).toMatchObject({
			label: 'No warnings',
			hasData: false
		});
	});

	test('warnings that the selection hides read "Warnings by episode"', () => {
		expect(dddStatus(result([tag]), 0)).toMatchObject({
			label: 'Warnings by episode',
			hasData: true
		});
	});
});
