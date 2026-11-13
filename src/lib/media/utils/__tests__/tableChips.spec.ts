import { describe, expect, it } from 'vitest';
import { TableFilters, parseFilters } from '../moderationFilters.ts';
import { filterChips, tableHref } from '../tableChips.ts';

const base = TableFilters.parse({});

describe('tableHref', () => {
	it('is the table tab alone for no filters, and carries every set one', () => {
		expect(tableHref(base)).toBe('?tab=table');
		expect(tableHref({ ...base, q: 'a b', sort: 'oldest', page: 3 })).toBe(
			'?tab=table&q=a+b&sort=oldest&page=3'
		);
	});
});

describe('filterChips', () => {
	it('has none for a plain table', () => {
		expect(filterChips(base)).toEqual([]);
	});

	it('has one chip per value, and each link drops only that value and returns to page 1', () => {
		const filters = parseFilters(
			new URLSearchParams(
				'q=troll&status=pending&status=hidden&category=hate&category=trolling&severity=2&source=ai&reported=1&title=Alien&author=anna&from=2026-11-01&to=2026-11-09&sort=reports&page=4'
			)
		);
		const chips = filterChips(filters);
		expect(chips.map((chip) => chip.label)).toEqual([
			'Text: troll',
			'Status: Awaiting review',
			'Status: Hidden',
			'Category: Hate',
			'Category: Trolling',
			'Severity 2 or higher',
			'Status set by: Automatic check',
			'Has open reports',
			'Title: Alien',
			'Author: anna',
			'From 2026-11-01',
			'Until 2026-11-09',
			'Most open reports'
		]);
		const status = chips.find((chip) => chip.key === 'status-pending');
		expect(status?.href).toBe(
			'?tab=table&q=troll&status=hidden&category=hate&category=trolling&severity=2&source=ai&reported=1&title=Alien&author=anna&from=2026-11-01&to=2026-11-09&sort=reports'
		);
		expect(chips.find((chip) => chip.key === 'sort')?.href).not.toContain('sort=');
		const onlyStatus = filterChips({ ...base, status: ['hidden'] });
		expect(onlyStatus[0].href).toBe('?tab=table');
	});
});
