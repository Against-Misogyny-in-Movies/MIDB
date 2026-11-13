import { render, screen } from '@testing-library/svelte';
import { afterEach, describe, it, expect } from 'vitest';
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

describe('CollapsibleSection open on hash', () => {
	const section = { title: 'Linked', id: 'linked', children: (() => {}) as never };

	afterEach(() => {
		window.location.hash = '';
	});

	it('stays closed without a matching hash', () => {
		const { container } = render(CollapsibleSection, { ...section, open: false, openOnHash: true });
		expect(container.querySelector('details')!.open).toBe(false);
	});

	it('opens on mount when the hash matches', () => {
		window.location.hash = '#linked';
		const { container } = render(CollapsibleSection, { ...section, open: false, openOnHash: true });
		expect(container.querySelector('details')!.open).toBe(true);
	});

	it('ignores the hash without openOnHash', () => {
		window.location.hash = '#linked';
		const { container } = render(CollapsibleSection, { ...section, open: false });
		expect(container.querySelector('details')!.open).toBe(false);
	});

	it('opens when the hash changes to it', async () => {
		const { container } = render(CollapsibleSection, { ...section, open: false, openOnHash: true });
		window.location.hash = '#linked';
		window.dispatchEvent(new HashChangeEvent('hashchange'));
		expect(container.querySelector('details')!.open).toBe(true);
	});

	it('opens again on a click of a link to the hash the page is already on', async () => {
		window.location.hash = '#linked';
		const { container } = render(CollapsibleSection, { ...section, open: false, openOnHash: true });
		const el = container.querySelector('details')!;
		el.open = false;
		const link = document.createElement('a');
		link.href = '#linked';
		document.body.appendChild(link);
		link.click();
		link.remove();
		expect(el.open).toBe(true);
	});

	it('marks the details busy', () => {
		const { container } = render(CollapsibleSection, { ...section, status: 'Loading', busy: true });
		expect(container.querySelector('details')!.getAttribute('aria-busy')).toBe('true');
	});
});
