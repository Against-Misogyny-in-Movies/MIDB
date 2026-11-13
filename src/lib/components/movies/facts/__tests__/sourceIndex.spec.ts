import { cleanup, render, screen } from '@testing-library/svelte';
import { afterEach, describe, expect, it } from 'vitest';
import { sourceIndex } from '#lib/media/utils/sourceIndex.ts';
import type { LetterboxdResult } from '#lib/media/types/letterboxd.ts';
import SourceIndex from '../sourceIndex.svelte';

afterEach(cleanup);

const items = (
	kind: 'movie' | 'tv',
	letterboxd?: { result: LetterboxdResult | null | undefined }
) =>
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

	it('links the value to the film on Letterboxd', () => {
		render(SourceIndex, { items: items('movie', { result }) });
		const link = screen.getByText('Letterboxd').closest('a');
		expect(link?.getAttribute('href')).toBe('https://boxd.it/abc12');
		expect(link?.getAttribute('rel')).toBe('noopener');
		expect(link?.getAttribute('title')).toBe('Average of 1,234 ratings on Letterboxd');
	});

	it('reads No data, with no link, when there is no rating', () => {
		render(SourceIndex, { items: items('movie', { result: null }) });
		const slot = screen.getByText('Letterboxd').closest('li');
		expect(slot?.textContent).toContain('No data');
		expect(slot?.querySelector('a')).toBeNull();
	});
});
