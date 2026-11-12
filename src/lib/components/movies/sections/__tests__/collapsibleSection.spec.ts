import { render, screen } from '@testing-library/svelte';
import { describe, it, expect } from 'vitest';
import CollapsibleSection from '#lib/components/movies/sections/collapsibleSection.svelte';

const props = {
	title: 'Bechdel Test',
	sourceLabel: 'BechdelTest.com',
	sourceHref: 'https://bechdeltest.com/view/1',
	children: (() => {}) as never
};

describe('CollapsibleSection freshness', () => {
	it('shows the sync date beside the source link', () => {
		render(CollapsibleSection, { ...props, updatedAt: '2026-11-12T09:30:00.000Z' });
		expect(screen.getByText('Updated November 12, 2026')).toBeTruthy();
		expect(screen.getByText('Source: BechdelTest.com')).toBeTruthy();
	});

	it('groups the source link and its date apart from Methodology', () => {
		render(CollapsibleSection, {
			...props,
			updatedAt: '2026-11-12T09:30:00.000Z',
			learnHref: '/resources#bechdel'
		});
		const date = screen.getByText('Updated November 12, 2026');
		expect(date.tagName).toBe('TIME');
		expect(date.getAttribute('datetime')).toBe('2026-11-12T09:30:00.000Z');
		const group = date.parentElement!;
		expect(group.contains(screen.getByText('Source: BechdelTest.com'))).toBe(true);
		expect(group.contains(screen.getByText('Methodology'))).toBe(false);
	});

	it('shows nothing when no sync is recorded', () => {
		render(CollapsibleSection, { ...props, updatedAt: null });
		expect(screen.queryByText(/Updated/)).toBeNull();
	});

	it('shows nothing without a source link', () => {
		render(CollapsibleSection, {
			title: 'Unconsenting Media',
			updatedAt: '2026-11-12T09:30:00.000Z',
			children: (() => {}) as never
		});
		expect(screen.queryByText(/Updated/)).toBeNull();
	});
});
