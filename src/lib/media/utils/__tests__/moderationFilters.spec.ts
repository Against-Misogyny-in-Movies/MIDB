import { describe, it, expect } from 'vitest';
import { TableFilters, filtersToParams, parseFilters } from '#lib/media/utils/moderationFilters.ts';

const parse = (query: string) => parseFilters(new URLSearchParams(query));

describe('moderation table filters', () => {
	it('reads an empty query as the defaults', () => {
		expect(parse('')).toEqual({ sort: 'newest', page: 1 });
		expect(filtersToParams(parse('')).toString()).toBe('');
	});

	it('round-trips every field', () => {
		const filters = TableFilters.parse({
			q: 'a b&c',
			status: ['pending', 'hidden'],
			categories: ['violence', 'trolling'],
			minSeverity: 2,
			source: 'reports',
			reported: true,
			title: 'Alien',
			author: 'ann',
			from: '2026-11-01',
			to: '2026-11-30',
			sort: 'severity',
			page: 3
		});
		expect(parse(filtersToParams(filters).toString())).toEqual(filters);
	});

	it('drops bad values and keeps the good ones', () => {
		const filters = parse(
			[
				'status=pending&status=bogus&status=pending',
				'category=nope&category=hate',
				'severity=9',
				'source=ai%20',
				'reported=yes',
				'from=2026-02-31',
				'to=tomorrow',
				'sort=random',
				'page=0',
				'q=%20%20'
			].join('&')
		);
		expect(filters).toEqual({
			status: ['pending'],
			categories: ['hate'],
			sort: 'newest',
			page: 1
		});
	});

	it('drops text that is too long and pages that are not numbers', () => {
		expect(parse(`q=${'x'.repeat(201)}&page=abc`)).toEqual({ sort: 'newest', page: 1 });
		expect(parse('page=-2').page).toBe(1);
		expect(parse('page=99999999').page).toBe(1);
	});
});
