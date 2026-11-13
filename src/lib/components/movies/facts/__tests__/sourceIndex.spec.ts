import { cleanup, render, screen } from '@testing-library/svelte';
import { afterEach, describe, expect, it } from 'vitest';
import { sourceIndex } from '#lib/media/utils/sourceIndex.ts';
import type { LetterboxdOutcome, LetterboxdResult } from '#lib/media/types/letterboxd.ts';
import SourceIndex from '../sourceIndex.svelte';

afterEach(cleanup);

const items = (kind: 'movie' | 'tv', letterboxd?: { result: LetterboxdOutcome | undefined }) =>
	sourceIndex({
		kind,
		bechdelRating: null,
		umConcerns: null,
		umCandidateCount: 0,
		ddd: null,
		dddVisibleCount: 0,
		letterboxd
	});

const result: LetterboxdResult = {
	rating: 3.86,
	ratingCount: 1234,
	url: 'https://boxd.it/abc12'
};

describe('source index with Letterboxd', () => {
	it('has no Letterboxd slot without keys', () => {
		render(SourceIndex, { items: items('movie') });
		expect(screen.queryByText('Letterboxd')).toBeNull();
		expect(screen.getAllByRole('listitem')).toHaveLength(3);
	});

	it('has none on a series, keys or not', () => {
		render(SourceIndex, { items: items('tv', { result: result }) });
		expect(screen.queryByText('Letterboxd')).toBeNull();
	});

	it('reads Loading… and then the value in the same slot', async () => {
		const view = render(SourceIndex, { items: items('movie', { result: undefined }) });
		const slot = screen.getByText('Letterboxd').closest('li');
		expect(slot?.textContent).toContain('Loading…');
		expect(slot?.querySelector('[aria-busy]')).not.toBeNull();
		expect(slot?.querySelector('a')).toBeNull();

		await view.rerender({ items: items('movie', { result }) });

		expect(screen.getByText('Letterboxd').closest('li')).toBe(slot);
		expect(slot?.textContent).toContain('3.9/5');
		expect(slot?.querySelector('[aria-busy]')).toBeNull();
	});

	it('links the value to the film on Letterboxd in a new tab, with a full accessible name', () => {
		render(SourceIndex, { items: items('movie', { result }) });
		const link = screen.getByText('Letterboxd').closest('a');
		expect(link?.getAttribute('href')).toBe('https://boxd.it/abc12');
		expect(link?.getAttribute('target')).toBe('_blank');
		expect(link?.getAttribute('rel')).toBe('noopener noreferrer');
		expect(link?.getAttribute('title')).toBeNull();
		expect(link?.getAttribute('aria-label')).toBe(
			'Letterboxd: 3.9 out of 5 from 1,234 ratings, opens Letterboxd in a new tab'
		);
	});

	it('says "1 rating" for a single rating and omits the count when unknown', () => {
		const one = items('movie', { result: { ...result, ratingCount: 1 } });
		expect(one[3]?.ariaLabel).toBe(
			'Letterboxd: 3.9 out of 5 from 1 rating, opens Letterboxd in a new tab'
		);
		const none = items('movie', { result: { ...result, ratingCount: null } });
		expect(none[3]?.ariaLabel).toBe('Letterboxd: 3.9 out of 5, opens Letterboxd in a new tab');
	});

	it('reads Not available, muted and with no link, when the lookup failed', () => {
		render(SourceIndex, { items: items('movie', { result: 'failed' }) });
		const slot = screen.getByText('Letterboxd').closest('li');
		expect(slot?.textContent).toContain('Not available');
		expect(slot?.querySelector('a')).toBeNull();
		expect(slot?.querySelector('.value--empty')).not.toBeNull();
		expect(slot?.querySelector('[aria-busy]')).toBeNull();
	});

	it('reads No data, with no link, when there is no rating', () => {
		render(SourceIndex, { items: items('movie', { result: null }) });
		const slot = screen.getByText('Letterboxd').closest('li');
		expect(slot?.textContent).toContain('No data');
		expect(slot?.querySelector('a')).toBeNull();
	});
});
